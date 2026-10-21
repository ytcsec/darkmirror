// dmprobe: DarkMirror's read-only Windows network probe.
// Streams one JSON line per interval with the real TCP connection table (owning PID),
// per-connection byte counters (TCP extended statistics, needs elevation) and the
// interface byte totals. It never modifies the system except enabling per-connection
// statistics collection, which is how Windows exposes those counters.
//
// Build: csc /nologo /optimize /target:exe /out:dmprobe.exe dmprobe.cs
// Usage: dmprobe.exe [intervalMs]

using System;
using System.Collections.Generic;
using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Threading;

static class DmProbe
{
    const int AF_INET = 2;
    const int AF_INET6 = 23;
    const int TCP_TABLE_OWNER_PID_ALL = 5;
    const int TcpConnectionEstatsData = 1;
    const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

    [DllImport("iphlpapi.dll")]
    static extern uint GetExtendedTcpTable(IntPtr table, ref int size, bool order, int af, int tableClass, uint reserved);

    [DllImport("iphlpapi.dll")]
    static extern uint SetPerTcpConnectionEStats(IntPtr row, int estatsType, IntPtr rw, uint rwVersion, uint rwSize, uint offset);

    [DllImport("iphlpapi.dll")]
    static extern uint GetPerTcpConnectionEStats(IntPtr row, int estatsType, IntPtr rw, uint rwVersion, uint rwSize,
        IntPtr ros, uint rosVersion, uint rosSize, IntPtr rod, uint rodVersion, uint rodSize);

    [DllImport("iphlpapi.dll")]
    static extern uint SetPerTcp6ConnectionEStats(IntPtr row, int estatsType, IntPtr rw, uint rwVersion, uint rwSize, uint offset);

    [DllImport("iphlpapi.dll")]
    static extern uint GetPerTcp6ConnectionEStats(IntPtr row, int estatsType, IntPtr rw, uint rwVersion, uint rwSize,
        IntPtr ros, uint rosVersion, uint rosSize, IntPtr rod, uint rodVersion, uint rodSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr OpenProcess(uint access, bool inherit, int pid);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder name, ref int size);

    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);

    static readonly HashSet<string> enabled = new HashSet<string>();
    static readonly Dictionary<int, string> pathCache = new Dictionary<int, string>();
    static bool estatsAvailable = true;
    static uint lastEStatsError = 0;
    const uint ROD_SIZE = 96; // sizeof(TCP_ESTATS_DATA_ROD_v0); the API rejects any other size

    static void Main(string[] args)
    {
        int interval = 1500;
        if (args.Length > 0) int.TryParse(args[0], out interval);
        if (interval < 250) interval = 250;

        bool admin = new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator);
        Console.OutputEncoding = new UTF8Encoding(false);

        while (true)
        {
            try { Console.WriteLine(Snapshot(admin)); Console.Out.Flush(); }
            catch (Exception e) { Console.WriteLine("{\"error\":" + Json(e.Message) + "}"); Console.Out.Flush(); }
            Thread.Sleep(interval);
        }
    }

    static string Snapshot(bool admin)
    {
        var sb = new StringBuilder();
        long rx = 0, tx = 0;
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (nic.OperationalStatus != OperationalStatus.Up) continue;
            if (nic.NetworkInterfaceType == NetworkInterfaceType.Loopback || nic.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;
            try { var s = nic.GetIPStatistics(); rx += s.BytesReceived; tx += s.BytesSent; } catch { }
        }

        var seen = new HashSet<string>();
        var rows = new List<string>();
        var newPaths = new Dictionary<int, string>();
        ReadTable(AF_INET, rows, seen, newPaths, admin);
        ReadTable(AF_INET6, rows, seen, newPaths, admin);
        enabled.IntersectWith(seen);

        sb.Append("{\"t\":").Append(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        sb.Append(",\"admin\":").Append(admin ? "true" : "false");
        sb.Append(",\"estats\":").Append(admin && estatsAvailable ? "true" : "false");
        sb.Append(",\"estatsErr\":").Append(lastEStatsError);
        sb.Append(",\"rx\":").Append(rx).Append(",\"tx\":").Append(tx);
        sb.Append(",\"tcp\":[").Append(string.Join(",", rows)).Append("]");
        sb.Append(",\"paths\":{");
        bool first = true;
        foreach (var kv in newPaths)
        {
            if (!first) sb.Append(',');
            first = false;
            sb.Append('"').Append(kv.Key).Append("\":").Append(Json(kv.Value));
        }
        sb.Append("}}");
        return sb.ToString();
    }

    static void ReadTable(int af, List<string> rows, HashSet<string> seen, Dictionary<int, string> newPaths, bool admin)
    {
        int size = 0;
        GetExtendedTcpTable(IntPtr.Zero, ref size, false, af, TCP_TABLE_OWNER_PID_ALL, 0);
        IntPtr buf = Marshal.AllocHGlobal(size + 4096);
        try
        {
            size += 4096;
            if (GetExtendedTcpTable(buf, ref size, false, af, TCP_TABLE_OWNER_PID_ALL, 0) != 0) return;
            int count = Marshal.ReadInt32(buf);
            int rowSize = af == AF_INET ? 24 : 56;
            for (int i = 0; i < count; i++)
            {
                IntPtr r = IntPtr.Add(buf, 4 + i * rowSize);
                int state, pid, lport, rport;
                string lip, rip;
                if (af == AF_INET)
                {
                    state = Marshal.ReadInt32(r, 0);
                    lip = new IPAddress((uint)Marshal.ReadInt32(r, 4)).ToString();
                    lport = Port(Marshal.ReadInt32(r, 8));
                    rip = new IPAddress((uint)Marshal.ReadInt32(r, 12)).ToString();
                    rport = Port(Marshal.ReadInt32(r, 16));
                    pid = Marshal.ReadInt32(r, 20);
                }
                else
                {
                    lip = V6(r, 0);
                    lport = Port(Marshal.ReadInt32(r, 20));
                    rip = V6(r, 24);
                    rport = Port(Marshal.ReadInt32(r, 44));
                    state = Marshal.ReadInt32(r, 48);
                    pid = Marshal.ReadInt32(r, 52);
                }

                // 5 = ESTABLISHED, 3 = SYN_SENT, 8 = CLOSE_WAIT; listeners and TIME_WAIT carry no owner traffic
                if (state != 5 && state != 3 && state != 8) continue;
                if (IsLoopback(rip)) continue;

                long bin = -1, bout = -1;
                string key = af + "|" + lip + "|" + lport + "|" + rip + "|" + rport;
                seen.Add(key);
                if (admin && estatsAvailable) ReadEStats(af, r, key, out bin, out bout);

                if (!pathCache.ContainsKey(pid))
                {
                    string p = ProcessPath(pid);
                    pathCache[pid] = p;
                    if (p != null) newPaths[pid] = p;
                }

                rows.Add("[" + pid + "," + Json(lip) + "," + lport + "," + Json(rip) + "," + rport + "," + state + "," + bin + "," + bout + "]");
            }
        }
        finally { Marshal.FreeHGlobal(buf); }
    }

    static void ReadEStats(int af, IntPtr ownerRow, string key, out long bin, out long bout)
    {
        bin = -1; bout = -1;
        // Build MIB_TCPROW / MIB_TCP6ROW from the owner-pid row
        IntPtr row = Marshal.AllocHGlobal(64);
        IntPtr rw = Marshal.AllocHGlobal(8);
        IntPtr rod = Marshal.AllocHGlobal(256);
        try
        {
            if (af == AF_INET)
            {
                for (int o = 0; o < 20; o += 4) Marshal.WriteInt32(row, o, Marshal.ReadInt32(ownerRow, o));
            }
            else
            {
                Marshal.WriteInt32(row, 0, Marshal.ReadInt32(ownerRow, 48)); // State
                for (int o = 0; o < 24; o += 4) Marshal.WriteInt32(row, 4 + o, Marshal.ReadInt32(ownerRow, o));   // local addr, scope, port
                for (int o = 0; o < 24; o += 4) Marshal.WriteInt32(row, 28 + o, Marshal.ReadInt32(ownerRow, 24 + o)); // remote addr, scope, port
            }

            if (!enabled.Contains(key))
            {
                Marshal.WriteInt32(rw, 0, 1); // EnableCollection = TRUE
                uint set = af == AF_INET
                    ? SetPerTcpConnectionEStats(row, TcpConnectionEstatsData, rw, 0, 1, 0)
                    : SetPerTcp6ConnectionEStats(row, TcpConnectionEstatsData, rw, 0, 1, 0);
                if (set == 5) { estatsAvailable = false; lastEStatsError = set; return; } // ERROR_ACCESS_DENIED
                if (set != 0) { lastEStatsError = set; return; }
                enabled.Add(key);
            }

            for (int o = 0; o < 256; o += 4) Marshal.WriteInt32(rod, o, 0);
            uint got = af == AF_INET
                ? GetPerTcpConnectionEStats(row, TcpConnectionEstatsData, IntPtr.Zero, 0, 0, IntPtr.Zero, 0, 0, rod, 0, ROD_SIZE)
                : GetPerTcp6ConnectionEStats(row, TcpConnectionEstatsData, IntPtr.Zero, 0, 0, IntPtr.Zero, 0, 0, rod, 0, ROD_SIZE);
            if (got != 0) { lastEStatsError = got; return; }
            bout = Marshal.ReadInt64(rod, 0);  // TCP_ESTATS_DATA_ROD_v0.DataBytesOut
            bin = Marshal.ReadInt64(rod, 16);  // TCP_ESTATS_DATA_ROD_v0.DataBytesIn
        }
        finally
        {
            Marshal.FreeHGlobal(row);
            Marshal.FreeHGlobal(rw);
            Marshal.FreeHGlobal(rod);
        }
    }

    static string ProcessPath(int pid)
    {
        if (pid <= 4) return null;
        IntPtr h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        if (h == IntPtr.Zero) return null;
        try
        {
            var sb = new StringBuilder(1024);
            int len = sb.Capacity;
            return QueryFullProcessImageName(h, 0, sb, ref len) ? sb.ToString(0, len) : null;
        }
        finally { CloseHandle(h); }
    }

    static int Port(int raw) { return ((raw & 0xFF) << 8) | ((raw >> 8) & 0xFF); }

    static string V6(IntPtr r, int offset)
    {
        var b = new byte[16];
        Marshal.Copy(IntPtr.Add(r, offset), b, 0, 16);
        var a = new IPAddress(b);
        return a.IsIPv4MappedToIPv6 ? a.MapToIPv4().ToString() : a.ToString();
    }

    static bool IsLoopback(string ip)
    {
        return ip == "0.0.0.0" || ip == "::" || ip.StartsWith("127.") || ip == "::1";
    }

    static string Json(string s)
    {
        if (s == null) return "null";
        var sb = new StringBuilder("\"");
        foreach (char c in s)
        {
            if (c == '"' || c == '\\') sb.Append('\\').Append(c);
            else if (c < 0x20) sb.AppendFormat("\\u{0:x4}", (int)c);
            else sb.Append(c);
        }
        return sb.Append('"').ToString();
    }
}

import type { NextConfig } from "next";
import os from "os";

// Dynamically allow LAN IP addresses for Next.js 15+ HMR over local network
const getLocalIPs = () => {
  const ips: string[] = ["localhost"];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name];
    if (ifaces) {
      for (const iface of ifaces) {
        if (iface.family === "IPv4" && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
  }
  return ips;
};

const nextConfig: NextConfig = {
  allowedDevOrigins: getLocalIPs(),
};

export default nextConfig;

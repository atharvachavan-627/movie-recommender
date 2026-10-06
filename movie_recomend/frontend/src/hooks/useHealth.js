import { useEffect, useState } from "react";
import { fetchHealth } from "../services/api";

// 'checking' | 'online' | 'offline'
export default function useHealth() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const h = await fetchHealth();
        if (alive) setStatus(h?.status === "online" ? "online" : "offline");
      } catch {
        if (alive) setStatus("offline");
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return status;
}

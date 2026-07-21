import type { Response } from "express";

export interface SseClient {
  id: number;
  res: Response;
}

let nextId = 1;
const clients = new Map<number, SseClient>();

export function addSseClient(res: Response): number {
  const id = nextId++;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": connected\n\n");
  clients.set(id, { id, res });
  res.on("close", () => clients.delete(id));
  return id;
}

export function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients.values()) {
    client.res.write(payload);
  }
}

export function sseCount(): number {
  return clients.size;
}

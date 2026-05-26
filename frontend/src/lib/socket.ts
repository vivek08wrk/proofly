import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.IO client instance.
 * Lazy initialization — only connects when first called.
 * withCredentials sends the auth cookie with the WS handshake.
 */
export const getSocket = (): Socket => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(
    process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5000",
    {
      withCredentials: true,
      transports: ["polling"],
      autoConnect: true,
    }
  );

  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
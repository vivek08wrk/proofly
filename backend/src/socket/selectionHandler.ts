import { Server as SocketIOServer, Socket } from "socket.io";

/**
 * Registers all Socket.IO event handlers.
 *
 * Room strategy:
 * - Photographer joins "project:{projectId}" room to receive upload progress
 * - Client joins same room to sync selections in real-time
 *
 * This way one room handles both use cases per project.
 */
export const registerSocketHandlers = (
  io: SocketIOServer,
  socket: Socket
): void => {
  // Join a project room (both photographer and client use this)
  socket.on("join:project", (projectId: string) => {
    const room = `project:${projectId}`;
    socket.join(room);
    console.log(`🔌 Socket ${socket.id} joined room: ${room}`);
  });

  // Leave a project room
  socket.on("leave:project", (projectId: string) => {
    const room = `project:${projectId}`;
    socket.leave(room);
    console.log(`🔌 Socket ${socket.id} left room: ${room}`);
  });
};
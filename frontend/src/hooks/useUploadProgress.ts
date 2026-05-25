"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/store/index";
import {
  setUploadProgress,
  setProcessing,
  setUploadDone,
  setUploadError,
} from "@/store/slices/uploadSlice";
import { getSocket } from "@/lib/socket";

interface UploadProgressEvent {
  phase: string;
  current?: number;
  total?: number;
  percent: number;
  message: string;
  filename?: string;
}

interface UploadCompleteEvent {
  projectId: string;
  totalPhotos: number;
  message: string;
}

interface UploadErrorEvent {
  message: string;
}

/**
 * Hook that connects to Socket.IO and listens for upload progress
 * events for a specific project room.
 *
 * Automatically joins the project room on mount and leaves on unmount.
 */
export const useUploadProgress = (projectId: string | null) => {
  const dispatch = useAppDispatch();
  const hasJoined = useRef(false);

  useEffect(() => {
    if (!projectId) return;

    const socket = getSocket();

    const joinRoom = () => {
      socket.emit("join:project", projectId);
      hasJoined.current = true;
    };

    // Join immediately if connected, or wait for connection
    if (socket.connected) {
      joinRoom();
    } else {
      socket.once("connect", joinRoom);
    }

    // Listen for progress updates
    socket.on("upload:progress", (data: UploadProgressEvent) => {
      if (data.phase === "processing" || data.phase === "optimizing") {
        dispatch(setProcessing());
      }
      dispatch(setUploadProgress(data.percent));
    });

    // Listen for completion
    socket.on("upload:complete", (data: UploadCompleteEvent) => {
      dispatch(setUploadDone(data.projectId));
    });

    // Listen for errors
    socket.on("upload:error", (data: UploadErrorEvent) => {
      dispatch(setUploadError(data.message));
    });

    return () => {
      socket.emit("leave:project", projectId);
      socket.off("upload:progress");
      socket.off("upload:complete");
      socket.off("upload:error");
      socket.off("connect", joinRoom);
      hasJoined.current = false;
    };
  }, [projectId, dispatch]);
};
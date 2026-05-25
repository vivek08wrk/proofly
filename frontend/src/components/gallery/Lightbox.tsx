"use client";

import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { Photo } from "@/types/project";

interface LightboxProps {
	photos: Photo[];
	currentIndex: number;
	selectedPhotoIds: Set<string>;
	onClose: () => void;
	onNext: () => void;
	onPrev: () => void;
	onSelect: (photoId: string) => void;
}

export default function Lightbox({
	photos,
	currentIndex,
	selectedPhotoIds,
	onClose,
	onNext,
	onPrev,
	onSelect,
}: LightboxProps) {
	const photo = photos[currentIndex];
	const isSelected = photo ? selectedPhotoIds.has(photo.id) : false;

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
			if (event.key === "ArrowRight") onNext();
			if (event.key === "ArrowLeft") onPrev();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose, onNext, onPrev]);

	if (!photo) return null;

	return (
		<div
			className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm"
			onClick={onClose}
		>
			<div className="absolute top-4 right-4 flex items-center gap-2">
				<button
					className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
					onClick={(event) => {
						event.stopPropagation();
						onSelect(photo.id);
					}}
					aria-label={isSelected ? "Deselect photo" : "Select photo"}
				>
					{isSelected ? (
						<CheckCircle2 className="h-5 w-5" />
					) : (
						<Circle className="h-5 w-5" />
					)}
				</button>
				<button
					className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
					onClick={(event) => {
						event.stopPropagation();
						onClose();
					}}
					aria-label="Close lightbox"
				>
					<X className="h-5 w-5" />
				</button>
			</div>

			<button
				className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
				onClick={(event) => {
					event.stopPropagation();
					onPrev();
				}}
				aria-label="Previous photo"
			>
				<ChevronLeft className="h-6 w-6" />
			</button>

			<button
				className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
				onClick={(event) => {
					event.stopPropagation();
					onNext();
				}}
				aria-label="Next photo"
			>
				<ChevronRight className="h-6 w-6" />
			</button>

			<div
				className="flex h-full w-full items-center justify-center px-6"
				onClick={(event) => event.stopPropagation()}
			>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={photo.previewUrl}
					alt={photo.originalFilename}
					className="max-h-[85vh] w-auto max-w-full rounded-lg shadow-2xl"
				/>
			</div>

			<div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-xs text-white">
				{currentIndex + 1} / {photos.length}
			</div>
		</div>
	);
}

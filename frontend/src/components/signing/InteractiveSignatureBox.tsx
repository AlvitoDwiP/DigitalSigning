import { useRef, useState, useEffect, useCallback, PointerEvent as ReactPointerEvent } from 'react';
import {
  SignatureVisualType,
  SignaturePlacement,
  MIN_TTE_WIDTH,
  MIN_TTE_HEIGHT,
  MAX_TTE_WIDTH,
  MAX_TTE_HEIGHT,
} from '../../utils/pdfHelper';
import { DocumentFontInfo } from '../../utils/pdfTypography';
import { IconMove, IconImage } from '../icons/Icons';

export type ResizeHandleType = 'move' | 'se' | 'sw' | 'ne' | 'nw';

export interface InteractiveSignatureBoxProps {
  placement: SignaturePlacement;
  onChangePlacement: (placement: SignaturePlacement) => void;
  effectiveWidth: number;
  effectiveHeight: number;
  scale: number;
  detectedFont: DocumentFontInfo;
  visualType?: SignatureVisualType;
  stampUrl: string | null;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  isOutOfBounds: boolean;
}

/**
 * Kalkulasi murni untuk translasi dan penskalaan koordinat kotak TTE saat di-drag atau di-resize.
 */
export function calculateResizedPlacement(
  handle: ResizeHandleType,
  deltaX_pts: number,
  deltaY_pts: number,
  start: SignaturePlacement,
  pageWidth: number,
  pageHeight: number
): SignaturePlacement {
  if (handle === 'move') {
    const newX = Math.max(0, Math.min(pageWidth - start.width, start.x + deltaX_pts));
    const newY = Math.max(0, Math.min(pageHeight - start.height, start.y + deltaY_pts));
    return { ...start, x: Math.round(newX), y: Math.round(newY) };
  }

  let { x, y, width, height } = start;

  if (handle === 'se') {
    width = Math.max(MIN_TTE_WIDTH, Math.min(pageWidth - start.x, Math.min(MAX_TTE_WIDTH, start.width + deltaX_pts)));
    height = Math.max(MIN_TTE_HEIGHT, Math.min(start.y + start.height, Math.min(MAX_TTE_HEIGHT, start.height - deltaY_pts)));
    y = Math.max(0, start.y + start.height - height);
  } else if (handle === 'ne') {
    width = Math.max(MIN_TTE_WIDTH, Math.min(pageWidth - start.x, Math.min(MAX_TTE_WIDTH, start.width + deltaX_pts)));
    height = Math.max(MIN_TTE_HEIGHT, Math.min(pageHeight - start.y, Math.min(MAX_TTE_HEIGHT, start.height + deltaY_pts)));
  } else if (handle === 'nw') {
    width = Math.max(MIN_TTE_WIDTH, Math.min(start.x + start.width, Math.min(MAX_TTE_WIDTH, start.width - deltaX_pts)));
    height = Math.max(MIN_TTE_HEIGHT, Math.min(pageHeight - start.y, Math.min(MAX_TTE_HEIGHT, start.height + deltaY_pts)));
    x = Math.max(0, start.x + start.width - width);
  } else if (handle === 'sw') {
    width = Math.max(MIN_TTE_WIDTH, Math.min(start.x + start.width, Math.min(MAX_TTE_WIDTH, start.width - deltaX_pts)));
    height = Math.max(MIN_TTE_HEIGHT, Math.min(start.y + start.height, Math.min(MAX_TTE_HEIGHT, start.height - deltaY_pts)));
    x = Math.max(0, start.x + start.width - width);
    y = Math.max(0, start.y + start.height - height);
  }

  return {
    ...start,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

const RESIZE_HANDLES: ResizeHandleType[] = ['se', 'sw', 'ne', 'nw'];

export function InteractiveSignatureBox({
  placement,
  onChangePlacement,
  effectiveWidth,
  effectiveHeight,
  scale,
  detectedFont,
  visualType: _visualType,
  stampUrl,
  isSelected,
  onSelect,
  isOutOfBounds,
}: InteractiveSignatureBoxProps): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Tutup seleksi saat pengguna klik di luar kotak
  useEffect(() => {
    if (!isSelected) return;
    const handleOutsideClick = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        onSelect(false);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, [isSelected, onSelect]);

  // Navigasi Keyboard Panah (← ↑ ↓ →)
  useEffect(() => {
    if (!isSelected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelect(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
      }

      e.preventDefault();
      const step = e.shiftKey ? 15 : e.altKey ? 1 : 5;
      const maxX = Math.max(0, effectiveWidth - placement.width);
      const maxY = Math.max(0, effectiveHeight - placement.height);

      let newX = placement.x;
      let newY = placement.y;

      if (e.key === 'ArrowLeft') newX = Math.max(0, placement.x - step);
      if (e.key === 'ArrowRight') newX = Math.min(maxX, placement.x + step);
      if (e.key === 'ArrowUp') newY = Math.min(maxY, placement.y + step);
      if (e.key === 'ArrowDown') newY = Math.max(0, placement.y - step);

      if (newX !== placement.x || newY !== placement.y) {
        onChangePlacement({ ...placement, x: Math.round(newX), y: Math.round(newY) });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, placement, effectiveWidth, effectiveHeight, onChangePlacement, onSelect]);

  // Handler Pointer Drag & Resize
  const handlePointerDown = useCallback(
    (e: ReactPointerEvent, handleType: ResizeHandleType) => {
      e.preventDefault();
      e.stopPropagation();
      boxRef.current?.focus({ preventScroll: true });

      const wasAlreadySelected = isSelected;
      if (!wasAlreadySelected) {
        onSelect(true);
      }

      const startClientX = e.clientX;
      const startClientY = e.clientY;
      const startPlacement = { ...placement };
      let hasPassedDragThreshold = wasAlreadySelected || handleType !== 'move';

      if (handleType === 'move' && wasAlreadySelected) {
        setIsDragging(true);
      } else if (handleType !== 'move') {
        setIsResizing(true);
      }

      const onPointerMove = (moveEvt: PointerEvent) => {
        const deltaX_screen = moveEvt.clientX - startClientX;
        const deltaY_screen = moveEvt.clientY - startClientY;

        if (!hasPassedDragThreshold) {
          if (Math.hypot(deltaX_screen, deltaY_screen) < 5) return;
          hasPassedDragThreshold = true;
          setIsDragging(true);
        }

        const deltaX_pts = deltaX_screen / scale;
        const deltaY_pts = -deltaY_screen / scale;

        const nextPlacement = calculateResizedPlacement(
          handleType,
          deltaX_pts,
          deltaY_pts,
          startPlacement,
          effectiveWidth,
          effectiveHeight
        );

        onChangePlacement(nextPlacement);
      };

      const onPointerUp = () => {
        setIsDragging(false);
        setIsResizing(false);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [isSelected, placement, scale, effectiveWidth, effectiveHeight, onChangePlacement, onSelect]
  );

  const boxWidthPct = (placement.width / effectiveWidth) * 100;
  const boxHeightPct = (placement.height / effectiveHeight) * 100;
  const boxLeftPct = (placement.x / effectiveWidth) * 100;
  const boxBottomPct = (placement.y / effectiveHeight) * 100;

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      className={`tte-interactive-sig-box ${isSelected ? 'is-selected' : 'is-unselected'} ${
        isOutOfBounds ? 'is-out' : ''
      } ${isDragging ? 'is-dragging' : ''} ${isResizing ? 'is-resizing' : ''}`}
      style={{
        left: `${boxLeftPct}%`,
        bottom: `${boxBottomPct}%`,
        width: `${boxWidthPct}%`,
        height: `${boxHeightPct}%`,
        fontFamily: detectedFont.fontFamily,
      }}
      role="region"
      aria-label="Kotak Tanda Tangan Elektronik"
      onPointerDown={(e) => handlePointerDown(e, 'move')}
    >
      {/* Drag Bar Handle */}
      {isSelected && (
        <div
          className={`tte-sig-drag-bar ${boxBottomPct + boxHeightPct > 90 ? 'is-below' : ''}`}
          title="Geser posisi kotak atau gunakan panah keyboard"
          onPointerDown={(e) => handlePointerDown(e, 'move')}
        >
          <span className="tte-sig-drag-label">
            <IconMove size={11} aria-hidden="true" />
            <span>Geser / ←↑↓→</span>
          </span>
          <span className="tte-sig-dim-label">
            {Math.round(placement.width)}×{Math.round(placement.height)} pt
          </span>
        </div>
      )}

      {/* Konten Kotak: Gambar Tanda Tangan */}
      <div className="tte-sig-box-content">
        {stampUrl ? (
          <div className="tte-sig-image-wrap" aria-hidden="true">
            <img src={stampUrl} alt="Stempel tanda tangan" className="tte-sig-image" />
          </div>
        ) : (
          <div className="tte-sig-placeholder-wrap">
            <IconImage size={24} className="tte-sig-placeholder-icon" />
            <span className="tte-sig-placeholder-text">Gambar Tanda Tangan</span>
            <span className="tte-sig-placeholder-sub">Unggah gambar di panel kiri</span>
          </div>
        )}
      </div>

      {/* Corner Resize Handles */}
      {isSelected &&
        RESIZE_HANDLES.map((handle) => (
          <div
            key={handle}
            className={`tte-resize-handle handle-${handle}`}
            title="Tarik sudut untuk mengubah ukuran"
            onPointerDown={(e) => handlePointerDown(e, handle)}
          />
        ))}
    </div>
  );
}


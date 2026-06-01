import { usePinchZoom } from '../hooks/usePinchZoom';

interface Props {
  url: string;
  isPdf?: boolean;
  onClose: () => void;
}

export default function ReceiptImageViewer({ url, isPdf = false, onClose }: Props) {
  const { scale, translateX, translateY, handlers } = usePinchZoom();

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 safe-top">
        <span className="text-gray-400 text-sm">Receipt</span>
        <button
          onClick={onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white text-2xl"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex items-center justify-center">
        {isPdf ? (
          <iframe src={url} className="w-full h-full border-0" title="Receipt PDF" />
        ) : (
          <div className="w-full h-full overflow-hidden flex items-center justify-center" {...handlers}>
            <img
              src={url}
              alt="Receipt"
              style={{
                transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
                transformOrigin: 'center center',
                touchAction: 'none',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transition: scale === 1 ? 'transform 0.2s' : 'none',
              }}
              draggable={false}
            />
          </div>
        )}
      </div>

      <div className="p-4 safe-bottom text-center text-gray-600 text-xs">
        Pinch to zoom • Double-tap to reset
      </div>
    </div>
  );
}

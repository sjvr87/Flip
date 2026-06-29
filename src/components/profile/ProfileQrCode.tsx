import QRCode from 'qrcode';
import { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

type Props = {
    value: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
};

export function ProfileQrCode({
    value,
    size = 200,
    color = '#000000',
    backgroundColor = '#ffffff',
}: Props) {
    const cells = useMemo(() => {
        if (!value) {
            return { moduleCount: 0, filled: [] as Array<{ x: number; y: number }> };
        }

        const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
        const modules = qr.modules;
        const moduleCount = modules.size;
        const filled: Array<{ x: number; y: number }> = [];

        for (let y = 0; y < moduleCount; y += 1) {
            for (let x = 0; x < moduleCount; x += 1) {
                if (modules.get(x, y)) {
                    filled.push({ x, y });
                }
            }
        }

        return { moduleCount, filled };
    }, [value]);

    if (!value || cells.moduleCount === 0) {
        return null;
    }

    const cellSize = size / cells.moduleCount;

    return (
        <Svg width={size} height={size}>
            <Rect x={0} y={0} width={size} height={size} fill={backgroundColor} />
            {cells.filled.map((cell) => (
                <Rect
                    key={`${cell.x}-${cell.y}`}
                    x={cell.x * cellSize}
                    y={cell.y * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={color}
                />
            ))}
        </Svg>
    );
}

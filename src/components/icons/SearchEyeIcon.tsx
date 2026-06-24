import { memo } from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

type SearchEyeIconProps = {
    size?: number;
    color?: string;
};

/**
 * Eye + magnifying glass search icon — almond eye outline, lens as iris,
 * handle through lower-right eyelid. Transparent background; stroke/fill only.
 */
const SearchEyeIcon = memo(function SearchEyeIcon({
    size = 24,
    color = '#FFFFFF',
}: SearchEyeIconProps) {
    const stroke = 2;
    const highlight =
        color.toLowerCase() === '#ffffff' || color.toLowerCase() === 'white'
            ? '#000000'
            : '#FFFFFF';
    const cx = 12;
    const cy = 11.5;
    const lensR = 4;
    const pupilR = 2;
    const handleRad = Math.PI / 4;
    const hx1 = cx + lensR * Math.cos(handleRad);
    const hy1 = cy + lensR * Math.sin(handleRad);

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M 2.5 12 C 6 5.5 18 5.5 21.5 12"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M 2.5 12 C 6 18.5 10 19.5 12.5 18"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M 16 17.5 C 18 19 21.5 13.5 21.5 12"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Circle cx={cx} cy={cy} r={lensR} stroke={color} strokeWidth={stroke} />
            <Circle cx={cx} cy={cy} r={pupilR} fill={color} />
            <Circle cx={cx + 0.85} cy={cy - 0.85} r={0.55} fill={highlight} />
            <Line
                x1={hx1}
                y1={hy1}
                x2={19.5}
                y2={19}
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default SearchEyeIcon;

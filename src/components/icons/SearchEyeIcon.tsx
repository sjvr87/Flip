import { memo } from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

type SearchEyeIconProps = {
    size?: number;
    color?: string;
};

/**
 * Eye + magnifying glass search icon — almond eye outline with a gap where
 * the handle exits the lower lid; lens sits below the upper rim with clear spacing.
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
    const cy = 12.8;
    const lensR = 3.5;
    const pupilR = 1.75;
    const handleRad = Math.PI / 4;
    const hx1 = cx + lensR * Math.cos(handleRad);
    const hy1 = cy + lensR * Math.sin(handleRad);

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M 2.5 12 C 6 6 18 6 21.5 12"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M 2.5 12 C 6 18.5 10 19.8 13.2 18.8"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M 17.2 17.2 C 18.8 18.6 20.8 15 21.5 12.2"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Circle cx={cx} cy={cy} r={lensR} stroke={color} strokeWidth={stroke} />
            <Circle cx={cx} cy={cy} r={pupilR} fill={color} />
            <Circle cx={cx + 0.75} cy={cy - 0.75} r={0.5} fill={highlight} />
            <Line
                x1={hx1}
                y1={hy1}
                x2={20.5}
                y2={20.5}
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
            />
        </Svg>
    );
});

export default SearchEyeIcon;

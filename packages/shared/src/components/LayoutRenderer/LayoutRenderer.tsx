import React, { useMemo } from 'react';
import { Stage, Layer, Rect, Text } from 'react-konva';

interface Tile {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isCut: boolean;
}

interface LayoutRendererProps {
  tiles: Tile[];
  width?: number;
  height?: number;
  showLabels?: boolean;
}

const LayoutRenderer: React.FC<LayoutRendererProps> = ({
  tiles,
  width = 800,
  height = 600,
  showLabels = true,
}) => {
  const scale = useMemo(() => {
    if (tiles.length === 0) return 1;
    const maxX = Math.max(...tiles.map((t) => t.x + t.width));
    const maxY = Math.max(...tiles.map((t) => t.y + t.height));
    return Math.min((width - 100) / maxX, (height - 100) / maxY, 1);
  }, [tiles, width, height]);

  const offsetX = 50;
  const offsetY = 50;

  const tileElems = useMemo(
    () =>
      tiles.map((tile) => (
        <React.Fragment key={tile.id}>
          <Rect
            x={tile.x * scale + offsetX}
            y={tile.y * scale + offsetY}
            width={tile.width * scale}
            height={tile.height * scale}
            fill={tile.isCut ? '#52c41a' : '#1890ff'}
            stroke="#333"
            strokeWidth={1}
            rotation={tile.rotation}
            opacity={0.8}
          />
          {showLabels && (
            <Text
              x={tile.x * scale + offsetX + 5}
              y={tile.y * scale + offsetY + 5}
              text={tile.isCut ? '切' : '整'}
              fontSize={12}
              fill="white"
            />
          )}
        </React.Fragment>
      )),
    [tiles, scale, showLabels]
  );

  return (
    <div
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        backgroundColor: '#fafafa',
        overflow: 'auto',
      }}
    >
      {tiles.length === 0 ? (
        <div
          style={{
            width,
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontSize: 16,
          }}
        >
          暂无排版数据
        </div>
      ) : (
        <Stage width={width} height={height}>
          <Layer>{tileElems}</Layer>
        </Stage>
      )}
    </div>
  );
};

export default React.memo(LayoutRenderer);

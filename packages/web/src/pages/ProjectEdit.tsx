import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, InputNumber, Select, Space, Typography, message, Upload, Tag } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, EyeOutlined, CameraOutlined, PlusOutlined, DeleteOutlined, BorderOutlined, UndoOutlined, RedoOutlined } from '@ant-design/icons';
import { Logo } from '../components/Logo';
import { sendSketch } from '../services/api';
import type { RcFile } from 'antd/es/upload/interface';

const { Text } = Typography;
const { Option } = Select;

const CANVAS_W = 860; const CANVAS_H = 560;

interface Vertex { x: number; y: number; }
interface RoomPolygon { id: string; name: string; vertices: Vertex[]; doorGaps?: { edgeIdx: number; t: number; width: number }[]; }
interface Obstacle { id: string; x: number; y: number; w: number; h: number; }

const TILE_PRESETS = [
  { label: '300×300 小地砖', w: 300, h: 300 }, { label: '300×600 中板', w: 300, h: 600 }, { label: '400×400 地砖', w: 400, h: 400 },
  { label: '400×800 中板', w: 400, h: 800 }, { label: '600×600 抛光砖', w: 600, h: 600 }, { label: '600×1200 大板', w: 600, h: 1200 },
  { label: '750×1500 岩板', w: 750, h: 1500 }, { label: '800×800 通体砖 ★', w: 800, h: 800 }, { label: '900×900 大砖', w: 900, h: 900 },
  { label: '1000×1000 大砖', w: 1000, h: 1000 }, { label: '1200×600 木纹砖', w: 1200, h: 600 }, { label: '1200×2400 岩板大板', w: 1200, h: 2400 },
  { label: '自定义尺寸', w: 0, h: 0 },
];

const ROOM_TEMPLATES: Record<string, Vertex[]> = {
  '矩形客厅': [{ x: 80, y: 60 }, { x: 480, y: 60 }, { x: 480, y: 340 }, { x: 80, y: 340 }],
  'L形客厅': [{ x: 80, y: 60 }, { x: 480, y: 60 }, { x: 480, y: 220 }, { x: 280, y: 220 }, { x: 280, y: 380 }, { x: 80, y: 380 }],
  '矩形卧室': [{ x: 80, y: 50 }, { x: 360, y: 50 }, { x: 360, y: 280 }, { x: 80, y: 280 }],
  '方形卫生间': [{ x: 80, y: 80 }, { x: 280, y: 80 }, { x: 280, y: 240 }, { x: 80, y: 240 }],
  '阳台': [{ x: 80, y: 80 }, { x: 480, y: 80 }, { x: 480, y: 160 }, { x: 80, y: 160 }],
};

const SNAP_THRESHOLD = 15;

function snapToHV(pts: Vertex[], idx: number, newX: number, newY: number): Vertex {
  const n = pts.length; const prev = pts[(idx - 1 + n) % n]; const next = pts[(idx + 1) % n];
  let rx = newX, ry = newY;
  if (Math.abs(newX - prev.x) < SNAP_THRESHOLD) rx = prev.x;
  if (Math.abs(newX - next.x) < SNAP_THRESHOLD) rx = next.x;
  if (Math.abs(newY - prev.y) < SNAP_THRESHOLD) ry = prev.y;
  if (Math.abs(newY - next.y) < SNAP_THRESHOLD) ry = next.y;
  return { x: Math.max(10, Math.min(CANVAS_W - 10, rx)), y: Math.max(10, Math.min(CANVAS_H - 10, ry)) };
}

type EditorMode = 'select' | 'draw' | 'obstacle' | 'door';

const ProjectEdit: React.FC = () => {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* --------------------- state --------------------- */
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<RoomPolygon[]>([
    { id: 'room-1', name: '客厅', vertices: [{ x: 80, y: 60 }, { x: 480, y: 60 }, { x: 480, y: 340 }, { x: 80, y: 340 }] },
  ]);
  const [activeRoomId, setActiveRoomId] = useState('room-1');
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<EditorMode>('select');
  const [sketchLoading, setSketchLoading] = useState(false);
  const [sketchResult, setSketchResult] = useState<string | null>(null);
  const [showWallPreview, setShowWallPreview] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  const [edgeInput, setEdgeInput] = useState('');
  const [mousePos, setMousePos] = useState<{x:number;y:number}|null>(null);

  /* --------------------- undo/redo --------------------- */
  const [history, setHistory] = useState<{ rooms: RoomPolygon[]; obstacles: Obstacle[] }[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const pushHistory = useCallback(() => {
    const snap = { rooms: JSON.parse(JSON.stringify(rooms)), obstacles: JSON.parse(JSON.stringify(obstacles)) };
    setHistory(prev => { const next = prev.slice(0, historyIdx + 1); next.push(snap); if (next.length > 50) next.shift(); return next; });
    setHistoryIdx(prev => Math.min(prev + 1, 49));
  }, [rooms, obstacles, historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx < 0) return;
    const snap = history[historyIdx];
    setRooms(snap.rooms); setObstacles(snap.obstacles);
    setHistoryIdx(prev => prev - 1);
    message.info('已撤销');
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx + 1 >= history.length) return;
    const snap = history[historyIdx + 1];
    setRooms(snap.rooms); setObstacles(snap.obstacles);
    setHistoryIdx(prev => prev + 1);
    message.info('已重做');
  }, [history, historyIdx]);

  useEffect(() => { document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } }); }, [undo, redo]);

  /* --------------------- derived --------------------- */
  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0];
  const vertices = activeRoom.vertices;
  const drawMode = mode === 'draw'; const obstacleMode = mode === 'obstacle'; const doorMode = mode === 'door';

  const setVertices = useCallback((fn: (prev: Vertex[]) => Vertex[]) => {
    pushHistory();
    setRooms(prev => prev.map(r => r.id === activeRoomId ? { ...r, vertices: fn(r.vertices) } : r));
  }, [activeRoomId, pushHistory]);

  const _addDoorGap = useCallback((edgeIdx: number, t: number) => {
    pushHistory();
    setRooms(prev => prev.map(r => {
      if (r.id !== activeRoomId) return r;
      const gaps = [...(r.doorGaps || []), { edgeIdx, t, width: 80 }];
      return { ...r, doorGaps: gaps };
    }));
    message.success('门洞已添加，可选中后调整');
  }, [activeRoomId, pushHistory]);

  /* --------------------- render --------------------- */
  const redraw = useCallback(() => {
    const c = canvasRef.current; if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1; c.width = CANVAS_W * dpr; c.height = CANVAS_H * dpr;
    c.style.width = CANVAS_W + 'px'; c.style.height = CANVAS_H + 'px'; ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H); ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    rooms.forEach((room, ri) => {
      const vs = room.vertices; if (vs.length < 2) return;
      const isActive = room.id === activeRoomId;
      const alpha = isActive ? 0.12 : 0.05; const strokeW = isActive ? 3 : 1.5;
      const doorGaps = room.doorGaps || [];

      if (showWallPreview && vs.length >= 3) {
        for (let i = 0; i < vs.length; i++) {
          const a = vs[i]; const b = vs[(i + 1) % vs.length];
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
          if (len < 1) continue;
          const nx = -dy / len * 4, ny = dx / len * 4;
          ctx.beginPath(); ctx.moveTo(a.x + nx, a.y + ny); ctx.lineTo(b.x + nx, b.y + ny);
          ctx.lineTo(b.x - nx, b.y - ny); ctx.lineTo(a.x - nx, a.y - ny); ctx.closePath();
          ctx.fillStyle = isActive ? 'rgba(26,54,93,0.25)' : 'rgba(148,163,184,0.15)'; ctx.fill();
          ctx.strokeStyle = isActive ? '#1a365d' : '#94a3b8'; ctx.lineWidth = 1; ctx.stroke();
        }
      }

      ctx.beginPath(); ctx.moveTo(vs[0].x, vs[0].y);
      for (let k = 1; k < vs.length; k++) ctx.lineTo(vs[k].x, vs[k].y); ctx.closePath();
      ctx.fillStyle = isActive ? `rgba(26,54,93,${alpha})` : `rgba(148,163,184,${alpha})`; ctx.fill();
      ctx.strokeStyle = isActive ? '#1a365d' : '#94a3b8'; ctx.lineWidth = strokeW; ctx.stroke();

      doorGaps.forEach(g => {
        const a = vs[g.edgeIdx], b = vs[(g.edgeIdx + 1) % vs.length];
        const gx = a.x + (b.x - a.x) * g.t, gy = a.y + (b.y - a.y) * g.t;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx*dx+dy*dy) || 1;
        const ux = -dy/len, uy = dx/len;
        ctx.fillStyle = '#fff'; ctx.fillRect(gx - g.width/2, gy - 3, g.width, 6);
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(gx + ux * 4, gy + uy * 4); ctx.lineTo(gx - ux * 4, gy - uy * 4); ctx.stroke();
        ctx.fillStyle = '#22c55e'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('门', gx, gy - 10);
      });

      ctx.fillStyle = isActive ? '#1a365d' : '#94a3b8'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(room.name, vs.reduce((s,v)=>s+v.x,0)/vs.length, vs.reduce((s,v)=>s+v.y,0)/vs.length);

      if (isActive && selectedEdge !== null && selectedEdge < vs.length) {
        const a = vs[selectedEdge], b = vs[(selectedEdge + 1) % vs.length];
        ctx.strokeStyle = '#d4a574'; ctx.lineWidth = 4; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      for (let i = 0; i < vs.length; i++) {
        const a = vs[i], b = vs[(i+1)%vs.length];
        const mx = (a.x+b.x)/2, my = (a.y+b.y)/2;
        const d = Math.round(Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2)*5);
        ctx.fillStyle = isActive?'#1a365d':'#64748b'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(d+'mm', mx+(b.y-a.y)*.04, my+(a.x-b.x)*.04);
      }
    });

    obstacles.forEach(o => {
      ctx.fillStyle = 'rgba(239,68,68,0.25)'; ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.setLineDash([4,3]); ctx.strokeRect(o.x,o.y,o.w,o.h); ctx.setLineDash([]);
      ctx.fillStyle = '#ef4444'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${o.w*5|0}×${o.h*5|0}`, o.x+o.w/2, o.y+o.h/2);
    });

    if (activeRoom && vertices.length > 0 && mousePos) {
      const last = vertices[vertices.length-1];
      ctx.strokeStyle = '#1a365d'; ctx.lineWidth = 2; ctx.setLineDash([5,5]);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(mousePos.x, mousePos.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#d4a574'; ctx.beginPath(); ctx.arc(last.x, last.y, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1a365d'; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
      const dist = Math.round(Math.sqrt((last.x-mousePos.x)**2+(last.y-mousePos.y)**2)*5);
      ctx.fillText('← '+dist+'mm', mousePos.x+10, mousePos.y-4);
    }

    if (mousePos) {
      ctx.strokeStyle = '#d4a574'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mousePos.x, mousePos.y, 4, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mousePos.x-8, mousePos.y); ctx.lineTo(mousePos.x+8, mousePos.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mousePos.x, mousePos.y-8); ctx.lineTo(mousePos.x, mousePos.y+8); ctx.stroke();
    }

    ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
    ctx.fillText('🟦铺贴 | 🟩门洞 | 🔴柱 | Ctrl+Z撤销 | 右键→退出', 10, CANVAS_H-10);

    if (activeRoom) {
      vertices.forEach((v, i) => {
        ctx.beginPath(); ctx.arc(v.x, v.y, i===draggingIdx?7:5, 0, Math.PI*2);
        ctx.fillStyle = i===draggingIdx?'#d4a574':'#1a365d'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('P'+(i+1), v.x, v.y-12);
      });
    }
  }, [rooms, activeRoomId, obstacles, draggingIdx, mode, showWallPreview, selectedEdge, mousePos]);

  useEffect(() => { redraw(); }, [redraw]);

  /* --------------------- interactions --------------------- */
  const getCanvasPos = useCallback((e: React.MouseEvent) => {
    const c = canvasRef.current; if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * CANVAS_W / r.width, y: (e.clientY - r.top) * CANVAS_H / r.height };
  }, []);

  const updateEdgeLength = useCallback(() => {
    if (selectedEdge === null) return;
    const mm = parseFloat(edgeInput); if (isNaN(mm)||mm<=0) { message.warning('请输入有效尺寸'); return; }
    const v = vertices; const a = v[selectedEdge], b = v[(selectedEdge+1)%v.length];
    const cur = Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2); if (cur < 1) return;
    const s = (mm/5)/cur, cx=(a.x+b.x)/2, cy=(a.y+b.y)/2;
    pushHistory();
    setVertices(() => {
      const n = [...v]; n[selectedEdge] = { x: cx+(a.x-cx)*s, y: cy+(a.y-cy)*s };
      n[(selectedEdge+1)%n.length] = { x: cx+(b.x-cx)*s, y: cy+(b.y-cy)*s };
      return n;
    });
    setSelectedEdge(null); setEdgeInput(''); message.success(`墙体= ${mm}mm`);
  }, [selectedEdge, edgeInput, vertices, pushHistory, setVertices]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e); if (!pos) return;
    if (obstacleMode) {
      pushHistory();
      setObstacles(p => [...p, { id: 'obs'+Date.now(), x: pos.x-25, y: pos.y-25, w: 50, h: 50 }]);
      return;
    }
    if (drawMode) { setVertices(p => [...p, pos]); return; }
    if (doorMode) {
      const vs = activeRoom?.vertices || [];
      for (let i = 0; i < vs.length; i++) {
        const a = vs[i], b = vs[(i+1)%vs.length]; const dx=b.x-a.x, dy=b.y-a.y; const len=Math.sqrt(dx*dx+dy*dy);
        if (len<1) continue;
        const t = Math.max(.1, Math.min(.9, ((pos.x-a.x)*dx+(pos.y-a.y)*dy)/(len*len)));
        const px=a.x+t*dx, py=a.y+t*dy;
        if (Math.sqrt((pos.x-px)**2+(pos.y-py)**2) < 18) { _addDoorGap(i, t); return; }
      }
      return;
    }
    const vs = activeRoom?.vertices || [];
    for (let i = 0; i < vs.length; i++) {
      const a = vs[i], b = vs[(i+1)%vs.length]; const dx=b.x-a.x, dy=b.y-a.y; const len=Math.sqrt(dx*dx+dy*dy);
      if (len<1) continue;
      const t = Math.max(0,Math.min(1,((pos.x-a.x)*dx+(pos.y-a.y)*dy)/(len*len)));
      const px=a.x+t*dx, py=a.y+t*dy;
      if (Math.sqrt((pos.x-px)**2+(pos.y-py)**2) < 16) { setSelectedEdge(i); setEdgeInput(String(Math.round(len*5))); return; }
    }
    setSelectedEdge(null);
  }, [drawMode, obstacleMode, doorMode, getCanvasPos, setVertices, pushHistory, activeRoom, _addDoorGap]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (drawMode || obstacleMode || doorMode) return;
    const pos = getCanvasPos(e); if (!pos) return;
    const vs = activeRoom?.vertices || [];
    for (let i = 0; i < vs.length; i++) { if (Math.sqrt((pos.x-vs[i].x)**2+(pos.y-vs[i].y)**2) < 12 && !drawMode) { setDraggingIdx(i); return; } }
  }, [drawMode, obstacleMode, doorMode, getCanvasPos, activeRoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasPos(e); setMousePos(pos);
    if (draggingIdx === null) return; if (!pos) return;
    const s = snapToHV(vertices, draggingIdx, pos.x, pos.y);
    setVertices(p => { const n=[...p]; n[draggingIdx]=s; return n; });
  }, [draggingIdx, getCanvasPos, vertices, setVertices]);

  const handleMouseUp = useCallback(() => {
    if (draggingIdx !== null) pushHistory();
    setDraggingIdx(null);
  }, [draggingIdx, pushHistory]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (drawMode && vertices.length > 0) {
      setVertices(prev => prev.slice(0, -1));
      if (vertices.length <= 1) {
        pushHistory();
        setVertices(() => []);
      }
      return;
    }
    if (drawMode || obstacleMode || doorMode) { setMode('select'); message.info('已退出编辑模式'); }
  }, [drawMode, obstacleMode, doorMode, vertices, setVertices, pushHistory]);

  const handleDblClick = useCallback((e: React.MouseEvent) => {
    if (vertices.length <= 3) return; const pos = getCanvasPos(e); if (!pos) return;
    for (let i = 0; i < vertices.length; i++) {
      if (Math.sqrt((pos.x-vertices[i].x)**2+(pos.y-vertices[i].y)**2) < 12) {
        pushHistory(); setVertices(p => p.filter((_,j)=>j!==i)); return;
      }
    }
    const oi = obstacles.findIndex(o => pos.x>=o.x&&pos.x<=o.x+o.w&&pos.y>=o.y&&pos.y<=o.y+o.h);
    if (oi>=0) { pushHistory(); setObstacles(p => p.filter((_,i)=>i!==oi)); return; }
    const vs = activeRoom?.vertices || [];
    for (let i=0;i<vs.length;i++) {
      const a=vs[i],b=vs[(i+1)%vs.length],dx=b.x-a.x,dy=b.y-a.y,len=Math.sqrt(dx*dx+dy*dy);
      if(len<1)continue;
      const t=Math.max(.1,Math.min(.9,((pos.x-a.x)*dx+(pos.y-a.y)*dy)/(len*len)));
      const px=a.x+t*dx,py=a.y+t*dy;
      if(Math.sqrt((pos.x-px)**2+(pos.y-py)**2)<18) {
        pushHistory();
        const np=[...vs.slice(0,i+1),{x:px,y:py},...vs.slice(i+1)];
        setVertices(()=>np); return;
      }
    }
  }, [vertices, obstacles, getCanvasPos, pushHistory, setVertices, activeRoom]);

  /* --------------------- room ops --------------------- */
  const addRoom = useCallback(() => {
    const ns=['客厅','餐厅','厨房','主卧','次卧','卫生间','阳台','过道'];
    const used=new Set(rooms.map(r=>r.name));
    const nm = ns.find(n=>!used.has(n))||'房间'+(rooms.length+1);
    const id='room'+Date.now();
    pushHistory();
    setRooms(p=>[...p,{id,name:nm,vertices:[]}]);
    setActiveRoomId(id); setMode('draw');
  }, [rooms, pushHistory]);

  const removeRoom = useCallback((id:string) => {
    if (rooms.length<=1) { message.warning('至少保留一个房间'); return; }
    pushHistory();
    setRooms(p=>p.filter(r=>r.id!==id));
    if (activeRoomId===id) setActiveRoomId(rooms[0].id===id?rooms[1].id:rooms[0].id);
  }, [rooms,activeRoomId, pushHistory]);

  const applyTemplate = useCallback((k:string) => {
    const t=ROOM_TEMPLATES[k]; if(!t)return;
    pushHistory(); setVertices(()=>t.map(v=>({...v}))); setMode('select');
  }, [pushHistory, setVertices]);

  const handleSketchUpload = useCallback(async (f: RcFile): Promise<false> => {
    setSketchLoading(true); setSketchResult(null);
    try {
      const r = await sendSketch(f);
      const d = r?.data || r;
      if (d?.polygons?.length > 0) {
        const p=d.polygons[0];
        const pts: Vertex[]=p.vertices.map((v:number[])=>({x:Math.max(50,Math.min(CANVAS_W-50,v[0]*.8+80)),y:Math.max(50,Math.min(CANVAS_H-50,v[1]*.6+60))}));
        pushHistory(); setVertices(()=>pts); setMode('select');
        setSketchResult(`识别成功: ${p.vertex_count}个顶点`);
        message.success('识别完成，可拖拽微调');
      } else { setSketchResult(d?.message||'未检测到'); message.warning('识别失败'); }
    } catch (e: any) { setSketchResult('失败: '+e.message); message.error('识别失败'); }
    finally { setSketchLoading(false); }
    return false;
  }, [pushHistory, setVertices]);

  const handleSave = useCallback(async () => {
    try {
      setLoading(true); await form.validateFields(); const v = form.getFieldsValue();
      const payload = {
        name: v.name,
        room_polygon: rooms.filter(r=>r.vertices.length>=3).map(r=>r.vertices.map(v=>[Math.round(v.x*5),Math.round(v.y*5)]))[0] || [[0,0],[3000,0],[3000,4000],[0,4000]],
        tile_config: { tileWidth: v.tileWidth, tileHeight: v.tileHeight, gapWidth: v.gapWidth, direction: v.direction, startPoint: { x:0,y:0 } },
      };
      const { createProject } = await import('../services/api');
      await createProject(payload); message.success('保存成功'); nav('/');
    } catch { message.error('请完善必填信息'); }
    finally { setLoading(false); }
  }, [form, rooms, nav]);

  const handlePreset = useCallback((idx: number) => {
    const p = TILE_PRESETS[idx];
    if (p.w > 0) {
      form.setFieldsValue({ tileWidth: p.w, tileHeight: p.h });
      message.success(`已选择 ${p.label}`);
    }
  }, [form]);

  /* --------------------- jsx --------------------- */
  return (
    <div className="page" style={{ padding: '24px 0' }}>
      <div className="page-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/')}>返回</Button>
            <Logo />
          </Space>
          <Space>
            <Button icon={<UndoOutlined />} onClick={undo} disabled={historyIdx < 0} title="Ctrl+Z" />
            <Button icon={<RedoOutlined />} onClick={redo} disabled={historyIdx + 1 >= history.length} title="Ctrl+Shift+Z" />
            <button className="btn btn-outline" onClick={() => nav(`/project/preview?projectId=${activeRoomId}`)} style={{ cursor: 'pointer' }}>
              <EyeOutlined /> 排版预览
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading} style={{ cursor: 'pointer' }}>
              <SaveOutlined /> 保存
            </button>
          </Space>
        </div>

        <div className="layout-grid-2">
          <Card title={<span>🏠 户型编辑</span>} style={{ borderRadius: 8 }}
            extra={
              <Space size={4} wrap>
                <Select size="small" value="" placeholder="模板" style={{ width: 100 }} onChange={applyTemplate}>
                  {Object.keys(ROOM_TEMPLATES).map(k => <Option key={k} value={k}>{k}</Option>)}
                </Select>
                <Upload accept="image/*" showUploadList={false} beforeUpload={handleSketchUpload}>
                  <Button size="small" icon={<CameraOutlined />} loading={sketchLoading}>拍照识别</Button>
                </Upload>
                <Button size="small" type={drawMode ? 'primary' : 'default'} onClick={() => setMode(drawMode ? 'select' : 'draw')}>{drawMode ? '绘制中' : '✏️ 画墙'}</Button>
                <Button size="small" type={obstacleMode ? 'primary' : 'default'} onClick={() => setMode(obstacleMode ? 'select' : 'obstacle')}>{obstacleMode ? '放置中' : '柱子'}</Button>
                <Button size="small" type={doorMode ? 'primary' : 'default'} onClick={() => setMode(doorMode ? 'select' : 'door')}>{doorMode ? '放置中' : '🚪 门洞'}</Button>
                <Button size="small" onClick={() => setShowWallPreview(!showWallPreview)}>{showWallPreview ? '隐藏墙体' : '显示墙体'}</Button>
                <Button size="small" onClick={addRoom} icon={<PlusOutlined />}>加房间</Button>
              </Space>
            }
          >
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {rooms.map(r => (
                <Tag key={r.id} color={r.id===activeRoomId?'#1a365d':'default'} style={{cursor:'pointer',padding:'4px 10px'}}
                  onClick={()=>{setActiveRoomId(r.id);setMode('select');}}>
                  {r.name} ({r.vertices.length}顶点{(r.doorGaps?.length||0)>0?',门':''})
                  <DeleteOutlined style={{marginLeft:6,fontSize:10}} onClick={e=>{e.stopPropagation();removeRoom(r.id);}}/>
                </Tag>
              ))}
            </div>
            <div style={{border:'2px solid #e2e8f0',borderRadius:8,overflow:'hidden',position:'relative',background:'#fff'}}>
              <canvas ref={canvasRef} onClick={handleClick} onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDblClick}
                onContextMenu={handleContextMenu}
                style={{display:'block',cursor:drawMode?'crosshair':obstacleMode?'cell':doorMode?'pointer':draggingIdx!==null?'grabbing':'default'}}/>
              {drawMode && <div style={{position:'absolute',top:10,left:16,background:'rgba(26,54,93,0.85)',color:'#fff',padding:'6px 14px',borderRadius:6,fontSize:12}}>点击添加顶点 | 双击墙体→打断插入顶点</div>}
              {obstacleMode && <div style={{position:'absolute',top:10,left:16,background:'rgba(239,68,68,0.85)',color:'#fff',padding:'6px 14px',borderRadius:6,fontSize:12}}>点击放置柱子 | 双击删除</div>}
              {doorMode && <div style={{position:'absolute',top:10,left:16,background:'rgba(34,197,94,0.85)',color:'#fff',padding:'6px 14px',borderRadius:6,fontSize:12}}>点击墙边添加门洞 | 双击删除</div>}
            </div>
            {sketchResult && <div style={{marginTop:8,padding:'6px 12px',borderRadius:6,fontSize:12,background:sketchResult.includes('成功')?'#f0fdf4':'#fef2f2',color:sketchResult.includes('成功')?'#166534':'#991b1b'}}>{sketchResult}</div>}
            {selectedEdge !== null && !drawMode && !obstacleMode && !doorMode && (
              <div style={{position:'absolute',top:60,right:16,zIndex:10,background:'#fff',padding:'10px 14px',borderRadius:8,boxShadow:'0 4px 20px rgba(0,0,0,.15)',border:'1px solid #d4a574',display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:12,color:'#1a365d',whiteSpace:'nowrap'}}>墙体长度</span>
                <input type="number" value={edgeInput} onChange={e => setEdgeInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')updateEdgeLength();if(e.key==='Escape')setSelectedEdge(null);}}
                  style={{width:72,padding:'4px 8px',border:'1px solid #d4a574',borderRadius:4,fontSize:14,textAlign:'center'}}/>
                <span style={{fontSize:12,color:'#64748b'}}>mm</span>
                <button onClick={updateEdgeLength} style={{padding:'4px 10px',background:'#d4a574',color:'#fff',border:'none',borderRadius:4,cursor:'pointer',fontSize:12}}>确定</button>
                <button onClick={()=>setSelectedEdge(null)} style={{padding:'4px 8px',background:'#f1f5f9',border:'none',borderRadius:4,cursor:'pointer',fontSize:12}}>✕</button>
              </div>
            )}
            <div style={{marginTop:8,fontSize:12,color:'#94a3b8',display:'flex',justifyContent:'space-between'}}>
              <span>房间:{rooms.length} | 门洞:{rooms.reduce((s,r)=>(r.doorGaps?.length||0)+s,0)} | 柱子:{obstacles.length}</span>
              <span>Ctrl+Z撤销 | 双击打断墙体/删除</span>
            </div>
          </Card>

          <div>
            <Card title={<span>📏 瓷砖规格</span>} style={{ borderRadius: 8, marginBottom: 16 }}>
              <Form form={form} layout="vertical" initialValues={{ name: '', tileWidth: 800, tileHeight: 800, gapWidth: 3, direction: 'horizontal' }}>
                <Form.Item label="方案名称" name="name" rules={[{ required: true, message: '请输入方案名称' }]}>
                  <Input placeholder="例如：全屋800×800亮光砖方案" />
                </Form.Item>
                <Form.Item label="市场通用规格">
                  <Select placeholder="选择常用规格自动填充" onChange={handlePreset} style={{ width: '100%' }} allowClear>
                    {TILE_PRESETS.map((p, i) => (
                      <Option key={i} value={i}>
                        {p.label}{p.w > 0 ? ` (${p.w}×${p.h}mm)` : ' (手动输入)'}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item label="瓷砖尺寸 (mm)">
                  <Space>
                    <Form.Item name="tileWidth" noStyle rules={[{ required: true }]}>
                      <InputNumber min={100} max={3000} placeholder="宽度" style={{ width: 110 }} addonAfter="mm" />
                    </Form.Item>
                    <Text style={{ fontSize: 18 }}>×</Text>
                    <Form.Item name="tileHeight" noStyle rules={[{ required: true }]}>
                      <InputNumber min={100} max={3000} placeholder="高度" style={{ width: 110 }} addonAfter="mm" />
                    </Form.Item>
                  </Space>
                </Form.Item>
                <Form.Item label="留缝宽度" name="gapWidth">
                  <Select><Option value={1}>1mm (密缝)</Option><Option value={2}>2mm (标准)</Option><Option value={3}>3mm (常用)</Option><Option value={5}>5mm (宽缝)</Option></Select>
                </Form.Item>
                <Form.Item label="铺贴方向" name="direction">
                  <Select options={[{value:'horizontal',label:'⬌ 横向'},{value:'vertical',label:'⬍ 纵向'},{value:'diagonal',label:'⤡ 斜45°'}]} />
                </Form.Item>
              </Form>
            </Card>

            <Card size="small" style={{ borderRadius: 8, background: '#f8fafc' }}>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 2 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>💡 操作说明</div>
                <div>• ✏️「画墙」逐点绘制 | 🚪「门洞」添加开门</div>
                <div>• 🧱「柱子」放障碍物 | 🔄 undo/redo 撤销重做</div>
                <div>• 🖱️ 点击墙体→输入尺寸自动定位</div>
                <div>• 👆 双击墙体→插入顶点(打断)</div>
                <div>• 📏 选择市场规格→自动填充瓷砖尺寸</div>
                <div>• 💾 保存→排版预览→导出确认单</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectEdit;

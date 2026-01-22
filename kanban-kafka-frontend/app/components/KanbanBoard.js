"use client";
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';

const emptyBoard = {
  order: { id: 'order', title: 'Orders', items: [] },
  invoice: { id: 'invoice', title: 'Invoices', items: [] },
  analytics: { id: 'analytics', title: 'Analytics', items: [] },
};

export default function KanbanBoard() {
  const [columns, setColumns] = useState(emptyBoard);
  const [socket, setSocket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderName, setOrderName] = useState("");
  const [serverStatus, setServerStatus] = useState(0);
  const [kafkaHealthy, setKafkaHealthy] = useState(true);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/user_${Math.random().toString(36).substr(2, 5)}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'sync_state') {
        // Initial load on refresh
        setColumns({
          order: { ...emptyBoard.order, items: data.data.order },
          invoice: { ...emptyBoard.invoice, items: data.data.invoice },
          analytics: { ...emptyBoard.analytics, items: data.data.analytics },
        });
      } else if (data.type === 'health') {
        setKafkaHealthy(data.status === 'healthy');
      } else if (data.type === 'new_card') {
        handleRemoteAdd(data);
      } else if (data.type === 'delete_card') {
        handleRemoteDelete(data.card_id);
      } else if (data.card_id) {
        handleRemoteMove(data);
      }
    };

    ws.onopen = () => setServerStatus(1);
    ws.onclose = () => setServerStatus(2);
    setSocket(ws);
    return () => ws.close();
  }, []);

  // --- Logic Handlers ---

  const submitOrder = (e) => {
    e.preventDefault();
    if (!orderName.trim()) return;
    const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const payload = { 
      type: "new_card", 
      card_id: `card-${Date.now()}`, 
      content: `${orderName} / #${orderId}`, 
      to_col: "order" 
    };
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    setOrderName("");
    setIsModalOpen(false);
  };

  const deleteOrder = (cardId) => {
    const payload = { type: "delete_card", card_id: cardId };
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  };

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    const moveData = { card_id: draggableId, from_col: source.droppableId, to_col: destination.droppableId, new_index: destination.index };
    handleRemoteMove(moveData); // Local update for speed
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(moveData));
  };

  // --- Remote State Updaters ---

  const handleRemoteAdd = (data) => {
    setColumns(prev => {
        const exists = Object.values(prev).some(col => col.items.some(i => i.id === data.card_id));
        if (exists) return prev;
        return { ...prev, [data.to_col]: { ...prev[data.to_col], items: [{ id: data.card_id, content: data.content }, ...prev[data.to_col].items] } };
    });
  };

  const handleRemoteDelete = (cardId) => {
    setColumns(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(id => newState[id].items = newState[id].items.filter(i => i.id !== cardId));
      return { ...newState };
    });
  };

  const handleRemoteMove = (move) => {
    setColumns(prev => {
      let movedItem = null;
      const newState = JSON.parse(JSON.stringify(prev));
      Object.keys(newState).forEach(id => {
        const idx = newState[id].items.findIndex(i => i.id === move.card_id);
        if (idx !== -1) {
            movedItem = newState[id].items.splice(idx, 1)[0];
        }
      });
      if (!movedItem) return prev;
      newState[move.to_col].items.splice(move.new_index, 0, movedItem);
      return newState;
    });
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black text-gray-900">Order Management</h1>
          <p className="text-gray-500 font-medium tracking-tight uppercase text-xs">Kafka Sync Layer Active</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-xl transition-all active:scale-95">
            + Place New Order
          </button>
          <div className="flex flex-col gap-2">
            <Badge label="API" status={serverStatus === 1} />
            <Badge label="KAFKA" status={kafkaHealthy} />
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-8 items-start">
        <DragDropContext onDragEnd={onDragEnd}>
          {Object.values(columns).map((col) => (
            <div key={col.id} className="w-80">
              <div className="bg-slate-900 p-4 rounded-t-3xl border-b-4 border-blue-600">
                <h2 className="font-bold text-white text-[10px] uppercase tracking-[0.3em] ml-2">{col.title}</h2>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef} 
                    className={`p-3 rounded-b-3xl min-h-[600px] transition-all duration-300 ${snapshot.isDraggingOver ? 'bg-blue-50/50 shadow-inner' : 'bg-gray-100/50'}`}
                  >
                    {col.items.map((item, index) => (
                      <DraggableCard key={item.id} item={item} index={index} onDelete={deleteOrder} />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </DragDropContext>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-3xl p-10 max-w-sm w-full shadow-2xl border border-white">
            <h3 className="text-3xl font-black mb-2 text-slate-800">New Order</h3>
            <p className="text-slate-400 text-sm mb-8 font-medium">This will produce a new event to Kafka.</p>
            <form onSubmit={submitOrder}>
              <input autoFocus className="w-full p-5 bg-slate-50 rounded-2xl mb-8 outline-none border-2 border-transparent focus:border-blue-500 transition-all font-semibold" placeholder="Item name..." value={orderName} onChange={e => setOrderName(e.target.value)} />
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-bold hover:text-slate-600">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DraggableCard({ item, index, onDelete }) {
  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => {
        const content = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={{ ...provided.draggableProps.style }}
            className={`bg-white p-6 mb-4 rounded-2xl shadow-sm border-2 flex justify-between items-center group transition-all ${snapshot.isDragging ? 'rotate-3 scale-105 shadow-2xl border-blue-500 z-[10000]' : 'border-transparent hover:border-slate-200'}`}
          >
            <span className="text-sm text-slate-800 font-bold tracking-tight">{item.content}</span>
            <button onClick={() => onDelete(item.id)} className="text-slate-200 hover:text-red-500 transition-colors p-1">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        );
        return snapshot.isDragging ? createPortal(content, document.body) : content;
      }}
    </Draggable>
  );
}

function Badge({ label, status }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm min-w-[120px]">
      <span className={`h-2.5 w-2.5 rounded-full ${status ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'}`}></span>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</span>
    </div>
  );
}
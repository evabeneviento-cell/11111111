
import React, { useEffect, useMemo, useState } from "react";

export default function HotelFastBill() {
  // --- Configurable settings ---
  const [settings, setSettings] = useState(() => {
    const s = localStorage.getItem("hfb_settings");
    return (
      s && JSON.parse(s)
    ) || {
      appName: "KS Thanh Vân",
      rounding: "ceil",
      pricePerHourDefault: 60000,
      waterPriceDefault: 10000,
      roomTypes: [
        { id: "single", name: "Single", multiplier: 1 },
        { id: "double", name: "Double", multiplier: 1.5 },
        { id: "deluxe", name: "Deluxe", multiplier: 2 }
      ]
    };
  });

  const [rooms, setRooms] = useState(() => {
    const r = localStorage.getItem("hfb_rooms");
    return (r && JSON.parse(r)) || [];
  });

  const [bookings, setBookings] = useState(() => {
    const b = localStorage.getItem("hfb_bookings");
    return (b && JSON.parse(b)) || [];
  });

  const [form, setForm] = useState({ roomId: rooms[0]?.id || "", checkIn: "", checkOut: "", waterS: 0, waterN: 0, waterB: 0, notes: "" });
  const [filter, setFilter] = useState({ q: "", from: "", to: "" });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [perPage, setPerPage] = useState(12);
  const [page, setPage] = useState(1);

  useEffect(() => {
    localStorage.setItem("hfb_rooms", JSON.stringify(rooms));
  }, [rooms]);
  useEffect(() => {
    localStorage.setItem("hfb_bookings", JSON.stringify(bookings));
  }, [bookings]);
  useEffect(() => {
    localStorage.setItem("hfb_settings", JSON.stringify(settings));
  }, [settings]);

  function parseDateInput(input) {
    return input ? new Date(input) : null;
  }

  function calcHours(checkInStr, checkOutStr) {
    const inD = parseDateInput(checkInStr);
    const outD = parseDateInput(checkOutStr);
    if (!inD || !outD || outD <= inD) return 0;
    const diffMs = outD - inD;
    const totalMinutes = Math.ceil(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const roundedHours = minutes > 20 ? hours + 1 : hours;
    return Math.max(1, roundedHours);
  }

  function roomById(id) {
    return rooms.find(r => r.id === id) || { id, name: id, type: "single" };
  }

  function pricingForCheckIn(checkInStr) {
    const d = parseDateInput(checkInStr);
    if (!d) return { first: settings.pricePerHourDefault, next: Math.round(settings.pricePerHourDefault * 0.33) };
    const h = d.getHours();
    if (h >= 6 && h < 22) return { first: 60000, next: 20000 };
    if (h === 22) return { first: 70000, next: 20000 };
    if (h === 23) return { first: 80000, next: 20000 };
    return { first: 100000, next: 30000 };
  }

  function priceForBooking(b) {
    const hours = calcHours(b.checkIn, b.checkOut);
    const p = pricingForCheckIn(b.checkIn);
    const roomCharge = p.first + (hours - 1) * p.next;
    const waterCharge = (Number(b.waterS || 0) * 10000) + (Number(b.waterN || 0) * 20000) + (Number(b.waterB || 0) * 30000);
    const total = roomCharge + waterCharge;
    return { hours, baseRateFirst: p.first, perHourNext: p.next, roomCharge, waterCharge, total };
  }

  function addBooking(e) {
    e?.preventDefault?.();
    if (!form.roomId) { alert("Vui lòng thêm và chọn một phòng trước khi tạo booking."); return; }
    if (!form.checkIn || !form.checkOut) { alert("Vui lòng nhập giờ vào và giờ ra."); return; }
    const b = {
      id: `bk_${Date.now()}`,
      roomId: form.roomId,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      waterS: Number(form.waterS || 0),
      waterN: Number(form.waterN || 0),
      waterB: Number(form.waterB || 0),
      notes: form.notes || "",
      createdAt: new Date().toISOString()
    };
    setBookings(prev => [b, ...prev]);
    setForm({ ...form, waterS: 0, waterN: 0, waterB: 0, notes: "" });
    setPage(1);
  }

  function deleteBooking(id) {
    if (!confirm("Xác nhận xoá booking này?")) return;
    setBookings(prev => prev.filter(p => p.id !== id));
  }

  function exportCSV() {
    const rows = [
      ["ID","Room","CheckIn","CheckOut","Hours","RoomCharge","WaterS","WaterN","WaterB","WaterCharge","Total","Notes","CreatedAt"]
    ];
    bookings.forEach(b => {
      const p = priceForBooking(b);
      rows.push([b.id, roomById(b.roomId).name, b.checkIn, b.checkOut, p.hours, p.roomCharge, b.waterS, b.waterN, b.waterB, p.waterCharge, p.total, b.notes, b.createdAt]);
    });
    const csv = rows.map(r => r.map(c => `\"${String(c).replace(/\"/g,'\"\"')}\"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ rooms, bookings, settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hotelfastbill_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.rooms) setRooms(data.rooms);
        if (data.bookings) setBookings(data.bookings);
        if (data.settings) setSettings(data.settings);
        alert("Import dữ liệu thành công.");
      } catch (err) {
        alert("File không đúng định dạng JSON.");
      }
    };
    reader.readAsText(file);
  }

  function printInvoice(booking) {
    const p = priceForBooking(booking);
    const room = roomById(booking.roomId);
    const html = `
      <html>
        <head>
          <title>Hóa đơn ${booking.id}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body{font-family: Arial, Helvetica, sans-serif; padding:20px; font-size:16px}
            .h{font-size:22px; font-weight:700}
            table{width:100%; border-collapse:collapse}
            td,th{padding:10px; border:1px solid #ddd}
            .right{text-align:right}
          </style>
        </head>
        <body>
          <h2>Hóa đơn - ${settings.appName || 'HotelFastBill'}</h2>
          <p>Booking ID: ${booking.id}</p>
          <p>Phòng: ${room.name} (${room.type})</p>
          <p>Check-in: ${booking.checkIn}</p>
          <p>Check-out: ${booking.checkOut}</p>
          <table>
            <thead><tr><th>Mô tả</th><th class='right'>Số</th><th class='right'>Đơn giá</th><th class='right'>Thành tiền</th></tr></thead>
            <tbody>
              <tr><td>Tiền phòng (${p.hours} giờ)</td><td class='right'>${p.hours}</td><td class='right'>${p.baseRateFirst.toLocaleString()}</td><td class='right'>${p.roomCharge.toLocaleString()}</td></tr>
              <tr><td>Tiền nước</td><td class='right'>S:${booking.waterS} N:${booking.waterN} B:${booking.waterB}</td><td class='right'>-</td><td class='right'>${p.waterCharge.toLocaleString()}</td></tr>
              <tr><th colspan='3' class='right'>TỔNG</th><th class='right'>${p.total.toLocaleString()}</th></tr>
            </tbody>
          </table>
          <p>Ghi chú: ${booking.notes}</p>
          <script>window.print();</script>
        </body>
      </html>
    `;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  }

  const filtered = useMemo(() => {
    let list = bookings.slice();
    if (filter.q) {
      const q = filter.q.toLowerCase();
      list = list.filter(b => b.id.includes(q) || roomById(b.roomId).name.toLowerCase().includes(q) || (b.notes || "").toLowerCase().includes(q));
    }
    if (filter.from) {
      const f = new Date(filter.from);
      list = list.filter(b => new Date(b.checkIn) >= f);
    }
    if (filter.to) {
      const t = new Date(filter.to);
      list = list.filter(b => new Date(b.checkOut) <= t);
    }
    return list;
  }, [bookings, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageList = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="min-h-screen bg-gray-900 p-6 text-lg text-gray-100">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">{settings.appName} — Quản lý tính tiền khách sạn</h1>
          <p className="text-base text-gray-400">Dark mode, chữ to, tối ưu cho điện thoại.</p>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-gray-800 p-4 rounded shadow">
            <h2 className="font-semibold mb-3 text-xl">Tạo booking mới</h2>
            {rooms.length === 0 ? (
              <div className="p-4 border rounded text-center text-base bg-gray-700">
                <p className="mb-2">Chưa có phòng nào. Vui lòng thêm phòng trước khi tạo booking.</p>
                <button onClick={() => {
                  const id = prompt('Số phòng (ví dụ 101)');
                  if(!id) return; const t = prompt('Loại phòng: single/double/deluxe','single');
                  setRooms(prev=> [{id, name:id, type: t || 'single', note: ''}, ...prev]);
                  setForm({...form, roomId: id});
                }} className="bg-green-600 text-white px-4 py-2 rounded">Thêm phòng</button>
              </div>
            ) : (
              <form onSubmit={addBooking} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <label className="flex flex-col"><span className="text-sm">Phòng</span>
                    <select value={form.roomId} onChange={e=>setForm({...form, roomId:e.target.value})} className="mt-1 p-3 border rounded text-base bg-gray-700 text-gray-100">
                      <option value="">-- Chọn phòng --</option>
                      {rooms.map(r=> <option key={r.id} value={r.id}>{r.name} — {r.type}</option>)}
                    </select>
                  </label>

                  <label className="flex flex-col"><span className="text-sm">Check-in</span>
                    <input type="datetime-local" value={form.checkIn} onChange={e=>setForm({...form, checkIn:e.target.value})} className="mt-1 p-3 border rounded text-base bg-gray-700 text-gray-100" />
                  </label>

                  <label className="flex flex-col"><span className="text-sm">Check-out</span>
                    <input type="datetime-local" value={form.checkOut} onChange={e=>setForm({...form, checkOut:e.target.value})} className="mt-1 p-3 border rounded text-base bg-gray-700 text-gray-100" />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <label className="flex flex-col"><span className="text-sm">Số nước - Suối (s)</span>
                    <input type="number" min={0} value={form.waterS} onChange={e=>setForm({...form, waterS: e.target.value})} className="mt-1 p-3 border rounded text-base bg-gray-700 text-gray-100" />
                  </label>
                  <label className="flex flex-col"><span className="text-sm">Số nước - Ngọt (n)</span>
                    <input type="number" min={0} value={form.waterN} onChange={e=>setForm({...form, waterN: e.target.value})} className="mt-1 p-3 border rounded text-base bg-gray-700 text-gray-100" />
                  </label>
                  <label className="flex flex-col"><span className="text-sm">Số bia (b)</span>
                    <input type="number" min={0} value={form.waterB} onChange={e=>setForm({...form, waterB: e.target.value})} className="mt-1 p-3 border rounded text-base bg-gray-700 text-gray-100" />
                  </label>
                  <div className="flex items-end">
                    <button type="submit" className="bg-blue-600 text-white px-4 py-3 rounded text-base">Lưu booking</button>
                  </div>
                </div>

                <div className="mt-2">
                  <label className="flex flex-col"><span className="text-sm">Ghi chú</span>
                    <input value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} className="mt-1 p-3 border rounded text-base bg-gray-700 text-gray-100" />
                  </label>
                </div>
              </form>
            )}

            <div className="mt-4 border-t pt-3">
              <h3 className="font-medium">Cài đặt nhanh</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                <label className="flex flex-col"><span className="text-sm">Chính sách làm tròn</span>
                  <select value={settings.rounding} onChange={e=>setSettings({...settings, rounding:e.target.value})} className="mt-1 p-3 border rounded text-base bg-gray-700 text-gray-100">
                    <option value="ceil">Làm tròn lên</option>
                    <option value="round">Làm tròn gần nhất</option>
                    <option value="floor">Làm xuống</option>
                  </select>
                </label>
                <label className="flex flex-col"><span className="text-sm">Giá giờ (gần đúng)</span>
                  <input type="number" value={settings.pricePerHourDefault} onChange={e=>setSettings({...settings, pricePerHourDefault: Number(e.target.value)})} className="mt-1 p-3 border rounded text-base bg-gray-700 text-gray-100" />
                </label>
                <label className="flex flex-col"><span className="text-sm">Giá nước (tham khảo)</span>
                  <input type="number" value={settings.waterPriceDefault} onChange={e=>setSettings({...settings, waterPriceDefault: Number(e.target.value)})} className="mt-1 p-3 border rounded text-base bg-gray-700 text-gray-100" />
                </label>
              </div>
            </div>
          </div>

          <aside className="bg-gray-800 p-4 rounded shadow">
            <h3 className="font-semibold mb-2 text-xl">Quản lý phòng</h3>
            <div className="space-y-2">
              {rooms.map(r => (
                <div key={r.id} className="flex items-center justify-between border p-3 rounded bg-gray-700">
                  <div>
                    <div className="font-medium">{r.name} <span className="text-sm text-gray-400">({r.type})</span></div>
                    <div className="text-sm text-gray-400">{r.note}</div>
                  </div>
                  <div className="space-x-1">
                    <button onClick={()=>{
                      const newName = prompt('Tên phòng', r.name); if(newName) setRooms(prev=> prev.map(rr=> rr.id===r.id? {...rr, name:newName}: rr))
                    }} className="px-3 py-2 border rounded text-base">Sửa</button>
                    <button onClick={()=> setRooms(prev=> prev.filter(rr=> rr.id!==r.id))} className="px-3 py-2 border rounded text-base">Xoá</button>
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <button onClick={()=>{
                  const id = prompt('Số phòng (ví dụ 103)');
                  if(!id) return; const t = prompt('Loại phòng: single/double/deluxe','single');
                  setRooms(prev=> [{id, name:id, type: t || 'single', note: ''}, ...prev]);
                }} className="w-full bg-green-600 text-white py-3 rounded text-base">Thêm phòng</button>
              </div>
              <div className="mt-3 text-sm text-gray-400">
                Lưu ý: dữ liệu được lưu trên trình duyệt. Bạn có thể xuất JSON để sao lưu.
              </div>
            </div>
          </aside>
        </section>

        <section className="bg-gray-800 p-4 rounded shadow mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-xl">Lịch sử & Báo cáo</h2>
            <div className="space-x-2">
              <button onClick={exportCSV} className="px-3 py-2 border rounded text-base">Xuất CSV</button>
              <button onClick={exportJSON} className="px-3 py-2 border rounded text-base">Sao lưu JSON</button>
              <label className="px-3 py-2 border rounded text-base cursor-pointer">
                Nhập JSON
                <input type="file" accept="application/json" onChange={e=> importJSON(e.target.files[0])} className="hidden" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
            <input placeholder="Tìm kiếm ID/Phòng/Ghi chú" value={filter.q} onChange={e=>{ setFilter({...filter, q: e.target.value}); setPage(1);}} className="p-3 border rounded md:col-span-2 text-base bg-gray-700 text-gray-100" />
            <input type="date" value={filter.from} onChange={e=>{ setFilter({...filter, from: e.target.value}); setPage(1);}} className="p-3 border rounded text-base bg-gray-700 text-gray-100" />
            <input type="date" value={filter.to} onChange={e=>{ setFilter({...filter, to: e.target.value}); setPage(1);}} className="p-3 border rounded text-base bg-gray-700 text-gray-100" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-auto text-base">
              <thead className="bg-gray-900">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Phòng</th>
                  <th className="p-3">Check-in</th>
                  <th className="p-3">Check-out</th>
                  <th className="p-3">Giờ</th>
                  <th className="p-3">Tổng</th>
                  <th className="p-3">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {pageList.map(b => {
                  const p = priceForBooking(b);
                  return (
                    <tr key={b.id} className="border-b bg-gray-800">
                      <td className="p-3">{b.id}</td>
                      <td className="p-3">{roomById(b.roomId).name}</td>
                      <td className="p-3">{b.checkIn}</td>
                      <td className="p-3">{b.checkOut}</td>
                      <td className="p-3">{p.hours}</td>
                      <td className="p-3">{p.total.toLocaleString()}</td>
                      <td className="p-3">
                        <button onClick={()=> setSelectedBooking(b)} className="px-3 py-2 border rounded mr-1 text-base">Xem</button>
                        <button onClick={()=> printInvoice(b)} className="px-3 py-2 border rounded mr-1 text-base">In</button>
                        <button onClick={()=> deleteBooking(b.id)} className="px-3 py-2 border rounded text-base">Xoá</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-base text-gray-400">Tổng {filtered.length} booking</div>
            <div className="space-x-2">
              <button onClick={()=> setPage(Math.max(1, page-1))} className="px-3 py-2 border rounded">Prev</button>
              <span> {page} / {totalPages} </span>
              <button onClick={()=> setPage(Math.min(totalPages, page+1))} className="px-3 py-2 border rounded">Next</button>
            </div>
          </div>
        </section>

        {selectedBooking && (
          <section className="bg-gray-800 p-4 rounded shadow mb-6">
            <h3 className="font-semibold mb-2 text-xl">Chi tiết booking</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <pre className="bg-gray-900 p-3 rounded text-base overflow-auto">{JSON.stringify(selectedBooking, null, 2)}</pre>
              </div>
              <div>
                <button onClick={()=> { printInvoice(selectedBooking); }} className="bg-blue-600 text-white px-3 py-2 rounded text-base">In hóa đơn</button>
                <button onClick={()=> { navigator.clipboard.writeText(JSON.stringify(selectedBooking)); alert('Copied'); }} className="ml-2 px-3 py-2 border rounded text-base">Sao chép JSON</button>
              </div>
            </div>
            <div className="mt-3 text-right">
              <button onClick={()=> setSelectedBooking(null)} className="px-3 py-2 border rounded">Đóng</button>
            </div>
          </section>
        )}

        <footer className="text-center text-base text-gray-400 mt-6">{settings.appName} — Dữ liệu lưu trữ cục bộ trên trình duyệt.</footer>
      </div>
    </div>
  );
}

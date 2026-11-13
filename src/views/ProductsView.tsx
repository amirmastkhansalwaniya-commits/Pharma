import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  Edit3,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { Product } from '../types/billing';
import { formatDateDisplay, formatINR } from '../utils/billingMath';
import { exportProductsCSV } from '../utils/csvExport';
import { GST_RATES, PRODUCT_UNITS } from '../utils/indianStates';
import { generateId } from '../utils/security';

interface ProductsViewProps {
  products: Product[];
  onSaveProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onSeedSampleProducts: () => Promise<void>;
}

type ProductFilter = 'all' | 'expiring' | 'low-stock';

const emptyProductForm = (): Omit<Product, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  hsnCode: '30049099',
  batchNumber: '',
  mfgDate: '',
  expiryDate: '',
  purchasePrice: 0,
  sellingPrice: 0,
  mrp: 0,
  unit: 'Bottle',
  taxRate: 12,
  stockQty: 0,
});

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  onSaveProduct,
  onDeleteProduct,
  onSeedSampleProducts,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyProductForm());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    return products.filter((p) => {
      if (filter === 'expiring') {
        if (!p.expiryDate) return false;
        if (new Date(p.expiryDate) > ninetyDays) return false;
      } else if (filter === 'low-stock') {
        if (p.stockQty > 10) return false;
      }

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.hsnCode.toLowerCase().includes(q) ||
        p.batchNumber.toLowerCase().includes(q)
      );
    });
  }, [products, search, filter]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyProductForm());
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      hsnCode: p.hsnCode,
      batchNumber: p.batchNumber,
      mfgDate: p.mfgDate,
      expiryDate: p.expiryDate,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      mrp: p.mrp,
      unit: p.unit,
      taxRate: p.taxRate,
      stockQty: p.stockQty,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const product: Product = {
        id: editing?.id || generateId('prod'),
        name: form.name.trim(),
        hsnCode: form.hsnCode.trim(),
        batchNumber: form.batchNumber.trim(),
        mfgDate: form.mfgDate,
        expiryDate: form.expiryDate,
        purchasePrice: Number(form.purchasePrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        mrp: Number(form.mrp) || 0,
        unit: form.unit || 'Bottle',
        taxRate: Number(form.taxRate) || 0,
        stockQty: Number(form.stockQty) || 0,
        createdAt: editing?.createdAt || now,
        updatedAt: now,
      };
      await onSaveProduct(product);
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const getExpiryBadge = (expiryDate: string) => {
    if (!expiryDate) return null;
    const exp = new Date(expiryDate);
    const now = new Date();
    const ninety = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    if (exp < now) {
      return <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Expired</span>;
    }
    if (exp <= ninety) {
      return (
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          Expiring Soon
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Veterinary Product Inventory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {products.length} products stored locally for automatic invoice selection
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportProductsCSV(products)}
            disabled={products.length === 0}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-4 w-4" />
            <span>CSV Export</span>
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Search & Segmented Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product name, HSN code, or batch..."
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
          {(
            [
              ['all', 'All Products'],
              ['expiring', 'Expiring / Expired'],
              ['low-stock', 'Low Stock'],
            ] as [ProductFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold transition whitespace-nowrap ${
                filter === key
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State or Data Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Package className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
            {products.length === 0 ? 'No products in your catalog yet' : 'No matching products'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {products.length === 0
              ? 'Add veterinary medicines, injections, boluses, and supplements for fast offline billing.'
              : 'Try adjusting your search query or filter.'}
          </p>
          {products.length === 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-900"
              >
                <Plus className="h-4 w-4" />
                <span>Add First Product</span>
              </button>
              <button
                type="button"
                onClick={onSeedSampleProducts}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Sparkles className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <span>Load Sample Vet Catalog</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Full-Width Table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                    <th className="px-4 py-3 font-semibold">Product Name</th>
                    <th className="px-3 py-3 font-semibold">HSN</th>
                    <th className="px-3 py-3 font-semibold">Batch No.</th>
                    <th className="px-3 py-3 font-semibold">Mfg / Expiry</th>
                    <th className="px-3 py-3 text-right font-semibold">Purchase</th>
                    <th className="px-3 py-3 text-right font-semibold">Selling</th>
                    <th className="px-3 py-3 text-right font-semibold">MRP</th>
                    <th className="px-3 py-3 text-right font-semibold">GST %</th>
                    <th className="px-3 py-3 text-right font-semibold">Stock</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((p) => {
                    const expBadge = getExpiryBadge(p.expiryDate);
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          <div>{p.name}</div>
                          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            Unit: {p.unit}
                            {expBadge && (
                              <>
                                {' · '}
                                {expBadge}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-700 dark:text-slate-300">
                          {p.hsnCode || '-'}
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-700 dark:text-slate-300">
                          {p.batchNumber || '-'}
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          <div>Mfg: {formatDateDisplay(p.mfgDate)}</div>
                          <div>Exp: {formatDateDisplay(p.expiryDate)}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {formatINR(p.purchasePrice)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                          {formatINR(p.sellingPrice)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {formatINR(p.mrp)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {p.taxRate}%
                        </td>
                        <td
                          className={`px-3 py-3 text-right font-mono font-semibold tabular-nums ${
                            p.stockQty <= 10
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {p.stockQty} {p.unit}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              title="Edit product"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(p)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                              title="Delete product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Touch Cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((p) => {
              const expBadge = getExpiryBadge(p.expiryDate);
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</h3>
                      <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                        HSN {p.hsnCode || '-'} · Batch {p.batchNumber || '-'} · GST {p.taxRate}%
                      </p>
                      {expBadge && <div className="mt-1">{expBadge}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-bold text-emerald-800 tabular-nums dark:text-emerald-400">
                        {formatINR(p.sellingPrice)}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                        MRP {formatINR(p.mrp)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                    <div className="font-mono text-slate-600 dark:text-slate-300">
                      Exp: {formatDateDisplay(p.expiryDate)} · Stock: {p.stockQty} {p.unit}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(p)}
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-rose-200 text-rose-600 dark:border-rose-900 dark:text-rose-400"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Edit Veterinary Product' : 'Add Veterinary Product'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Royal-Cal Gold Calcium Oral Suspension 1 Ltr"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    value={form.hsnCode}
                    onChange={(e) => setForm({ ...form, hsnCode: e.target.value })}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={form.batchNumber}
                    onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                    placeholder="e.g., RKV-2601A"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Unit
                  </label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Manufacturing Date
                  </label>
                  <input
                    type="date"
                    value={form.mfgDate}
                    onChange={(e) => setForm({ ...form, mfgDate: e.target.value })}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Purchase Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.purchasePrice}
                    onChange={(e) =>
                      setForm({ ...form, purchasePrice: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Selling Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.sellingPrice}
                    onChange={(e) =>
                      setForm({ ...form, sellingPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    MRP
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.mrp}
                    onChange={(e) => setForm({ ...form, mrp: parseFloat(e.target.value) || 0 })}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    GST Rate
                  </label>
                  <select
                    value={form.taxRate}
                    onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Stock Qty
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={form.stockQty}
                    onChange={(e) =>
                      setForm({ ...form, stockQty: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 focus:border-emerald-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 shrink-0 text-rose-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Product?
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Remove <strong>{confirmDelete.name}</strong> from your local catalog? Existing
                  invoices that already used this item will not be modified.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteProduct(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="min-h-[44px] rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

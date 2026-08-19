"use client";

import { upload } from "@vercel/blob/client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

export type AdminProduct = {
  id: string;
  handle: string;
  title: string;
  body: string;
  images: string[];
  types: string[];
  typePrices: Record<string, number>;
  colors: string[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

type Props = {
  products: AdminProduct[];
  onReload: () => Promise<void>;
};

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function blankProduct(sortOrder: number): AdminProduct {
  return {
    id: "",
    handle: "",
    title: "",
    body: "<p></p>",
    images: [],
    types: ["Regular Tee", "Oversized Tee", "Hoodie"],
    typePrices: { "Regular Tee": 500, "Oversized Tee": 800, Hoodie: 1000 },
    colors: ["black", "white"],
    sizes: ["S", "M", "L", "XL", "2XL"],
    minPrice: 500,
    maxPrice: 1000,
    isActive: true,
    sortOrder,
  };
}

export default function ProductManager({ products, onReload }: Props) {
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<AdminProduct | null>(null);
  const [handleTouched, setHandleTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(p => `${p.title} ${p.handle} ${p.types.join(" ")}`.toLowerCase().includes(needle));
  }, [products, q]);

  function startNew() {
    setError("");
    setHandleTouched(false);
    setDraft(blankProduct(Math.max(0, ...products.map(p => Number(p.sortOrder || 0))) + 10));
  }

  function startEdit(product: AdminProduct) {
    setError("");
    setHandleTouched(true);
    setDraft({
      ...product,
      images: [...(product.images || [])],
      types: [...(product.types || [])],
      typePrices: { ...(product.typePrices || {}) },
      colors: [...(product.colors || [])],
      sizes: [...(product.sizes || [])],
    });
  }

  async function saveProduct(e: FormEvent) {
    e.preventDefault();
    if (!draft || saving || uploading) return;
    setError("");
    if (!draft.title.trim()) return setError("Add a product title.");
    if (!draft.handle.trim()) return setError("Add a product URL handle.");
    if (!draft.types.length) return setError("Add at least one clothing type.");
    if (new Set(draft.types.map(x => x.trim().toLowerCase())).size !== draft.types.length) return setError("Clothing type names must be unique.");
    for (const t of draft.types) if (!t.trim() || !Number(draft.typePrices[t])) return setError(`Add a valid price for ${t || "each clothing type"}.`);

    setSaving(true);
    try {
      const endpoint = draft.id ? `/api/admin/products/${encodeURIComponent(draft.id)}` : "/api/admin/products";
      const r = await fetch(endpoint, {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save product");
      await onReload();
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  }

  async function archive(product: AdminProduct) {
    if (!window.confirm(`Remove “${product.title}” from the storefront?\n\nThe product will be archived rather than erased so old order records stay safe.`)) return;
    setError("");
    try {
      const r = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not remove product");
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove product");
    }
  }

  async function uploadImages(files: FileList | null) {
    if (!draft || !files?.length) return;
    setUploading(true);
    setError("");
    try {
      const next = [...draft.images];
      const handle = draft.handle || slugify(draft.title) || "new-product";
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error(`${file.name}: use JPG, PNG or WebP.`);
        setUploadStatus(`Uploading ${i + 1} of ${files.length}…`);
        const cleanName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
        const blob = await upload(`products/${handle}/${Date.now()}-${cleanName}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/products/upload",
          multipart: true,
          onUploadProgress: ({ percentage }) => setUploadStatus(`Uploading ${i + 1} of ${files.length} · ${Math.round(percentage)}%`),
        });
        next.push(blob.url);
      }
      setDraft(d => d ? { ...d, images: next.slice(0, 24) } : d);
      setUploadStatus("Upload complete ✓");
      setTimeout(() => setUploadStatus(""), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed");
      setUploadStatus("");
    } finally {
      setUploading(false);
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    if (!draft) return;
    const to = index + direction;
    if (to < 0 || to >= draft.images.length) return;
    const images = [...draft.images];
    [images[index], images[to]] = [images[to], images[index]];
    setDraft({ ...draft, images });
  }

  function makeCover(index: number) {
    if (!draft || index === 0) return;
    const images = [...draft.images];
    const [image] = images.splice(index, 1);
    images.unshift(image);
    setDraft({ ...draft, images });
  }

  function removeImage(index: number) {
    if (!draft) return;
    setDraft({ ...draft, images: draft.images.filter((_, i) => i !== index) });
  }

  function addType() {
    if (!draft) return;
    let n = draft.types.length + 1;
    let name = `New type ${n}`;
    while (draft.types.includes(name)) name = `New type ${++n}`;
    setDraft({ ...draft, types: [...draft.types, name], typePrices: { ...draft.typePrices, [name]: 500 } });
  }

  function updateType(index: number, name: string) {
    if (!draft) return;
    const old = draft.types[index];
    const types = [...draft.types];
    types[index] = name;
    const prices = { ...draft.typePrices };
    const price = prices[old] ?? 0;
    if (old !== name) delete prices[old];
    prices[name] = price;
    setDraft({ ...draft, types, typePrices: prices });
  }

  function removeType(index: number) {
    if (!draft) return;
    const old = draft.types[index];
    const types = draft.types.filter((_, i) => i !== index);
    const prices = { ...draft.typePrices };
    delete prices[old];
    setDraft({ ...draft, types, typePrices: prices });
  }

  const activeCount = products.filter(p => p.isActive).length;
  const archivedCount = products.length - activeCount;

  return <>
    <div className="catalogHero">
      <div>
        <div className="eyebrow">Catalogue</div>
        <h1>Products</h1>
        <p>Manage everything customers see and everything checkout uses for pricing.</p>
      </div>
      <button className="btn yellow" onClick={startNew}>+ Add product</button>
    </div>

    <div className="catalogStats">
      <span><b>{activeCount}</b> live products</span>
      <span><b>{archivedCount}</b> archived</span>
      <span>Changes become the checkout source of truth immediately.</span>
    </div>

    <div className="productToolbar">
      <input className="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search products, handles or clothing types" />
    </div>

    {error && !draft && <div className="error productGlobalError">{error}</div>}

    <section className="productAdminGrid">
      {filtered.map(product => <article className={`productAdminCard ${!product.isActive ? "archived" : ""}`} key={product.id}>
        <div className="productAdminImage">
          {product.images?.[0] ? <img src={product.images[0]} alt="" /> : <div className="productImageEmpty">No image</div>}
          <span className={`catalogStatus ${product.isActive ? "live" : "off"}`}>{product.isActive ? "Live" : "Archived"}</span>
        </div>
        <div className="productAdminBody">
          <div className="small productHandle">/{product.handle}</div>
          <h3>{product.title}</h3>
          <div className="productAdminMeta">
            <span>{product.types.length} type{product.types.length === 1 ? "" : "s"}</span>
            <span>{product.minPrice === product.maxPrice ? money(product.minPrice) : `${money(product.minPrice)}–${money(product.maxPrice)}`}</span>
          </div>
          <div className="productAdminVariants">{product.types.slice(0, 3).map(t => <span key={t}>{t} · {money(product.typePrices[t])}</span>)}</div>
          <div className="productAdminActions">
            <button className="btn" onClick={() => startEdit(product)}>Edit</button>
            {product.isActive && <a className="btn light" href={`https://www.petrocrib.in/product.html?handle=${encodeURIComponent(product.handle)}`} target="_blank" rel="noreferrer">Preview ↗</a>}
            {product.isActive && <button className="textDanger" onClick={() => archive(product)}>Delete</button>}
          </div>
        </div>
      </article>)}
      {!filtered.length && <div className="card empty">No products match that search.</div>}
    </section>

    {draft && <div className="editorBackdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving && !uploading) setDraft(null); }}>
      <form className="productEditor" onSubmit={saveProduct}>
        <div className="editorHeader">
          <div><div className="eyebrow">{draft.id ? "Edit product" : "New product"}</div><h2>{draft.title || "Untitled product"}</h2></div>
          <button type="button" className="editorClose" aria-label="Close" onClick={() => setDraft(null)} disabled={saving || uploading}>×</button>
        </div>

        <div className="editorBody">
          <section className="editorSection">
            <div className="editorSectionHead"><div><h3>Product basics</h3><p>Name, URL and storefront visibility.</p></div></div>
            <div className="editorGrid two">
              <Field label="Product title">
                <input value={draft.title} onChange={e => {
                  const title = e.target.value;
                  setDraft(d => d ? { ...d, title, handle: !handleTouched ? slugify(title) : d.handle } : d);
                }} placeholder="e.g. Thakida Thakida Christy" />
              </Field>
              <Field label="URL handle" hint="Lowercase letters, numbers and hyphens">
                <div className="handleInput"><span>petrocrib.in/product…/</span><input value={draft.handle} onChange={e => { setHandleTouched(true); setDraft(d => d ? { ...d, handle: slugify(e.target.value) } : d); }} placeholder="product-name" /></div>
              </Field>
              <Field label="Display order" hint="Lower numbers appear first">
                <input type="number" value={draft.sortOrder} onChange={e => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Storefront status">
                <label className="switchRow"><input type="checkbox" checked={draft.isActive} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} /><span className="toggle"/><b>{draft.isActive ? "Live" : "Archived / hidden"}</b></label>
              </Field>
            </div>
          </section>

          <section className="editorSection">
            <div className="editorSectionHead"><div><h3>Product images</h3><p>The first image is the cover. Upload JPG, PNG or WebP directly from your device.</p></div><label className={`btn ${uploading ? "disabled" : ""}`}>+ Upload images<input className="fileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={e => { uploadImages(e.currentTarget.files); e.currentTarget.value = ""; }} /></label></div>
            {uploadStatus && <div className="uploadStatus">{uploadStatus}</div>}
            <div className="imageEditorGrid">
              {draft.images.map((src, i) => <div className="imageEditCard" key={`${src}-${i}`}>
                <img src={src} alt="" />
                {i === 0 && <span className="coverBadge">Cover</span>}
                <div className="imageEditActions">
                  {i > 0 && <button type="button" onClick={() => makeCover(i)}>Cover</button>}
                  <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0}>←</button>
                  <button type="button" onClick={() => moveImage(i, 1)} disabled={i === draft.images.length - 1}>→</button>
                  <button type="button" className="danger" onClick={() => removeImage(i)}>Remove</button>
                </div>
              </div>)}
              {!draft.images.length && <label className="imageDropEmpty">No images yet<br/><span>Tap “Upload images” to add the product gallery.</span></label>}
            </div>
          </section>

          <section className="editorSection">
            <div className="editorSectionHead"><div><h3>Description</h3><p>Format the product story without editing HTML code.</p></div></div>
            <RichEditor key={draft.id || "new"} html={draft.body} onChange={body => setDraft(d => d ? { ...d, body } : d)} />
          </section>

          <section className="editorSection">
            <div className="editorSectionHead"><div><h3>Clothing types & prices</h3><p>These prices are also used by secure checkout validation.</p></div><button className="btn light" type="button" onClick={addType}>+ Add type</button></div>
            <div className="variantEditor">
              {draft.types.map((type, i) => <div className="variantRow" key={`${i}-${type}`}>
                <div><label>Type</label><input value={type} onChange={e => updateType(i, e.target.value)} placeholder="Regular Tee" /></div>
                <div><label>Price (₹)</label><input type="number" min="1" step="1" value={draft.typePrices[type] ?? ""} onChange={e => setDraft(d => d ? { ...d, typePrices: { ...d.typePrices, [type]: Number(e.target.value) } } : d)} /></div>
                <button type="button" className="removeCircle" onClick={() => removeType(i)} aria-label="Remove type" disabled={draft.types.length <= 1}>×</button>
              </div>)}
            </div>
            <PriceRange types={draft.types} prices={draft.typePrices} />
          </section>

          <section className="editorSection">
            <div className="editorSectionHead"><div><h3>Options</h3><p>Add every color and size customers can select.</p></div></div>
            <div className="editorGrid two">
              <StringListEditor label="Colors" values={draft.colors} placeholder="e.g. black" onChange={colors => setDraft({ ...draft, colors })} />
              <StringListEditor label="Sizes" values={draft.sizes} placeholder="e.g. 3XL" onChange={sizes => setDraft({ ...draft, sizes })} />
            </div>
          </section>
        </div>

        <div className="editorFooter">
          <div>{error && <div className="error">{error}</div>}</div>
          <div className="editorFooterActions"><button type="button" className="btn light" onClick={() => setDraft(null)} disabled={saving || uploading}>Cancel</button><button className="btn yellow" disabled={saving || uploading}>{saving ? "Saving…" : draft.id ? "Save changes" : "Create product"}</button></div>
        </div>
      </form>
    </div>}
  </>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="editorField"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function PriceRange({ types, prices }: { types: string[]; prices: Record<string, number> }) {
  const values = types.map(t => Number(prices[t] || 0)).filter(Boolean);
  if (!values.length) return null;
  const min = Math.min(...values), max = Math.max(...values);
  return <div className="calculatedPrice">Storefront price range: <b>{min === max ? money(min) : `${money(min)} – ${money(max)}`}</b> <span>· calculated automatically</span></div>;
}

function StringListEditor({ label, values, placeholder, onChange }: { label: string; values: string[]; placeholder: string; onChange: (v: string[]) => void }) {
  const [value, setValue] = useState("");
  function add() {
    const v = value.trim();
    if (!v || values.some(x => x.toLowerCase() === v.toLowerCase())) return setValue("");
    onChange([...values, v]); setValue("");
  }
  return <div className="listEditor"><label>{label}</label><div className="tagList">{values.map((v, i) => <span className="optionTag" key={`${v}-${i}`}>{v}<button type="button" onClick={() => onChange(values.filter((_, x) => x !== i))}>×</button></span>)}</div><div className="tagAdd"><input value={value} placeholder={placeholder} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} /><button type="button" className="btn light" onClick={add}>Add</button></div></div>;
}

function RichEditor({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = html || "<p></p>"; }, []);
  function command(cmd: string, value?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
    if (ref.current) onChange(ref.current.innerHTML);
  }
  return <div className="richEditor">
    <div className="richToolbar">
      <button type="button" onMouseDown={e => { e.preventDefault(); command("formatBlock", "p"); }}>Text</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); command("formatBlock", "h2"); }}>Heading</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); command("formatBlock", "h3"); }}>Subheading</button>
      <button type="button" onMouseDown={e => { e.preventDefault(); command("bold"); }}><b>B</b></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); command("italic"); }}><i>I</i></button>
      <button type="button" onMouseDown={e => { e.preventDefault(); command("insertUnorderedList"); }}>• List</button>
    </div>
    <div ref={ref} className="richCanvas" contentEditable suppressContentEditableWarning onInput={e => onChange(e.currentTarget.innerHTML)} />
  </div>;
}

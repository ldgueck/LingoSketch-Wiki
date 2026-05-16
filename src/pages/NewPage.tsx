import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, HelpCircle } from "lucide-react";
import { Layout } from "../components/Layout";

export default function NewPage() {
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      const sanitized = name.trim().replace(/ /g, "_");
      navigate(`/edit/${sanitized}`);
    }
  };

  return (
    <Layout pageTitle="Create New Page">
      <div className="max-w-2xl">
        <form onSubmit={handleCreate} className="flex flex-col gap-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider block">Page Name</label>
            <input
              type="text"
              className="w-full text-3xl font-bold bg-transparent border-b-4 border-slate-200 focus:border-blue-500 outline-none pb-2 transition-colors placeholder:text-slate-200"
              placeholder="Enter page title..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-500 shrink-0 h-fit">
              <HelpCircle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">Naming Conventions</h4>
              <p className="text-slate-600 text-sm leading-relaxed">
                Wiki pages are typically named using <strong>PascalCase</strong> (e.g. <code>AddressBook</code>) or with underscores.
                Avoid special characters like <code>?</code>, <code>#</code>, or <code>/</code>.
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-10 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 font-bold text-lg self-start"
            disabled={!name.trim()}
          >
            <Plus size={24} /> Create Page
          </button>
        </form>
      </div>
    </Layout>
  );
}

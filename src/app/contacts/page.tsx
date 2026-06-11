"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  useCount: number;
  createdBy: { name: string; email: string };
}

export default function ContactsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/");
  }, [authStatus, router]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) loadContacts();
  }, [session, search]);

  const handleAdd = async () => {
    if (!newName.trim() || !newNumber.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, phoneNumber: newNumber }),
      });
      if (res.ok) {
        setNewName("");
        setNewNumber("");
        setShowAdd(false);
        loadContacts();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from address book?`)) return;
    try {
      await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
      loadContacts();
    } catch (e) {
      console.error(e);
    }
  };

  if (authStatus === "loading" || !session) {
    return <div className="p-8"><div className="animate-pulse h-8 w-48 bg-surface-200 rounded" /></div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-surface-800">Address Book</h1>
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "+ Add Contact"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Name</label>
              <input
                type="text"
                className="input"
                placeholder="Healthspring WOL"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-600 mb-1">Fax Number</label>
              <input
                type="tel"
                className="input"
                placeholder="(855) 350-8671"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
              />
            </div>
          </div>
          <button className="btn-primary" onClick={handleAdd} disabled={saving || !newName || !newNumber}>
            {saving ? "Saving..." : "Save Contact"}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          className="input sm:max-w-sm"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Contact list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-400">Loading...</div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-surface-400">
            {search ? "No contacts match your search" : "No saved contacts yet"}
          </div>
        ) : (
          <div className="divide-y divide-surface-50">
            {contacts.map((c) => (
              <div key={c.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-50">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500 font-semibold text-sm">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-700">{c.name}</p>
                  <p className="text-xs text-surface-400 font-mono">{c.phoneNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-surface-400">{c.useCount} faxes sent</p>
                  <p className="text-xs text-surface-300">by {c.createdBy?.name || c.createdBy?.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/send?to=${encodeURIComponent(c.phoneNumber)}&name=${encodeURIComponent(c.name)}`)}
                    className="text-xs text-brand-500 hover:text-brand-600 font-medium"
                  >
                    Send fax
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    className="text-xs text-surface-300 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

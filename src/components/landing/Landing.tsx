import { useState } from "react";
import { HandHeart, HeartHandshake, Infinity as InfinityIcon, LogIn, Percent, Users } from "lucide-react";
import logo from "@/assets/sauhrida-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { StaffLoginDialog } from "@/components/StaffLoginDialog";

const PILLARS = [
  { icon: Users, en: "36 Hearts", ml: "36 ഹൃദയങ്ങൾ", text: "Thirty-six faculty members of one college, one circle of trust." },
  { icon: Percent, en: "Zero Interest", ml: "പലിശയില്ല", text: "Every rupee given comes back as goodwill — never as interest." },
  { icon: InfinityIcon, en: "Infinite Brotherhood", ml: "അനന്തമായ സാഹോദര്യം", text: "Standing by each other at life's big moments." },
];

/** What signed-out visitors see: an introduction and the way in. No figures, names or schedules. */
export function Landing() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-emerald-gradient text-primary-foreground">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full border border-gold/25" />
        <div className="pointer-events-none absolute -left-16 bottom-0 size-56 rounded-full border border-gold/15" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 pb-14 pt-12 text-center">
          <img src={logo.url} alt="Sauhrida Panappayattu emblem" className="size-24 rounded-full ring-4 ring-gold/70 sm:size-28" />
          <h1 className="font-ml mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">സൗഹൃദ പണപ്പയറ്റ്</h1>
          <p className="mt-2 text-sm font-medium uppercase tracking-[0.25em] text-gold-soft">Sauhrida Panappayattu</p>
          <p className="mt-4 max-w-xl text-base text-primary-foreground/85">
            The faculty fellowship fund of Sir Syed College, Taliparamba — a zero-interest Payattu where colleagues
            gather each month to lift one another.
          </p>
          <p className="font-ml mt-2 max-w-xl text-sm text-gold-soft">
            സർ സയ്യിദ് കോളേജ് അധ്യാപകരുടെ സൗഹൃദ പണപ്പയറ്റ്
          </p>
          <Button variant="gold" size="xl" className="mt-8 min-w-60 shadow-gold" onClick={() => setOpen(true)}>
            <LogIn /> Sign In <span className="font-ml">(ലോഗിൻ ചെയ്യുക)</span>
          </Button>
          <p className="mt-3 text-xs text-primary-foreground/65">For members of the Sauhrida circle only.</p>
        </div>
        <div className="gold-rule" />
      </section>

      <section className="mx-auto max-w-4xl px-5 py-10">
        <p className="text-center text-lg font-semibold italic text-primary">
          “36 Hearts, Zero Interest, Infinite Brotherhood”
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.en} className="rounded-3xl border border-gold/40 bg-card p-5 text-center shadow-card">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gold-soft text-accent-foreground">
                <p.icon className="size-6" />
              </span>
              <h2 className="mt-3 font-bold text-primary">{p.en}</h2>
              <p className="font-ml text-sm text-accent-foreground">{p.ml}</p>
              <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="flex gap-3 rounded-3xl border bg-card p-5 shadow-card">
            <HandHeart className="size-6 shrink-0 text-gold" />
            <div>
              <h3 className="font-semibold text-primary">What is a Payattu?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                A Malabar tradition of mutual help: friends contribute to one member's need, and that kindness is
                returned when it is their turn — over a cup of tea and good company.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-3xl border bg-card p-5 shadow-card">
            <HeartHandshake className="size-6 shrink-0 text-gold" />
            <div>
              <h3 className="font-semibold text-primary">Members only</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Contributions, recipients and gatherings are private to the circle. Sign in with the username the
                Admin shared with you.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="pb-10 text-center text-xs text-muted-foreground">
        Sir Syed College, Taliparamba · <span className="font-ml">സൗഹൃദ പണപ്പയറ്റ്</span>
      </footer>

      <StaffLoginDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

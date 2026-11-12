import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Member } from "@/lib/queries";

export function MemberSelect({
  members,
  value,
  onChange,
  placeholder = "Select faculty member",
  id,
  allowNone,
}: {
  members: Member[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  id?: string;
  allowNone?: boolean;
}) {
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
      <SelectTrigger id={id} className="h-11 bg-card">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {(allowNone || !value) && (
          <SelectItem value="none" disabled={!allowNone}>
            {allowNone ? "— Not assigned —" : placeholder}
          </SelectItem>
        )}
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {String(m.slot_no).padStart(2, "0")} · {m.name}{" "}
            <span className="text-muted-foreground">({m.department})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

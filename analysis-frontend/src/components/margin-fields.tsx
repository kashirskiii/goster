import { DEFAULT_MARGIN_RULE, type MarginRule } from "@/api/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  value: MarginRule | undefined;
  onChange: (next: MarginRule) => void;
  editable: boolean;
}

const SIDE_FIELDS: Array<{ key: keyof MarginRule; label: string }> = [
  { key: "left_mm", label: "Левое, мм" },
  { key: "right_mm", label: "Правое, мм" },
  { key: "top_mm", label: "Верх, мм" },
  { key: "bottom_mm", label: "Низ, мм" },
];

export function MarginFields({ value, onChange, editable }: Props) {
  const m = value ?? DEFAULT_MARGIN_RULE;

  const setField = (key: keyof MarginRule, raw: string) => {
    const num = Number(raw);
    onChange({ ...m, [key]: Number.isFinite(num) ? num : 0 });
  };

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SIDE_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs">{f.label}</Label>
            <Input
              type="number"
              step="0.5"
              value={m[f.key]}
              readOnly={!editable}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Допуск, мм</Label>
          <Input
            type="number"
            step="0.5"
            value={m.tolerance_mm}
            readOnly={!editable}
            onChange={(e) => setField("tolerance_mm", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Игнор сверху, мм</Label>
          <Input
            type="number"
            step="1"
            value={m.ignore_top_band_mm}
            readOnly={!editable}
            onChange={(e) => setField("ignore_top_band_mm", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Игнор снизу, мм</Label>
          <Input
            type="number"
            step="1"
            value={m.ignore_bottom_band_mm}
            readOnly={!editable}
            onChange={(e) => setField("ignore_bottom_band_mm", e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        В полосах «Игнор сверху/снизу» содержимое не учитывается при замере полей —
        обычно туда попадают колонтитулы и номер страницы.
      </p>
    </div>
  );
}

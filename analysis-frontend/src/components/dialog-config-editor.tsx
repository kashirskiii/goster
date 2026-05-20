import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { dialogsApi } from "@/api/endpoints";
import type {
  AllowedFontRule,
  GostConfig,
  MarginRule,
  ValidatorFlags,
} from "@/api/types";
import {
  DEFAULT_MARGIN_RULE,
  DEFAULT_VALIDATOR_FLAGS,
  VALIDATOR_TOGGLE_LABELS,
} from "@/api/types";
import { MarginFields } from "@/components/margin-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  dialogId: string;
  config: GostConfig | null;
  /** Открытые диалоги — редактируемы; иначе read-only. */
  editable: boolean;
}

function emptyRule(): AllowedFontRule {
  return {
    name: "",
    size: 14,
    color: [0, 0, 0],
    size_tolerance: 0.5,
    color_tolerance: 35,
    description: "",
  };
}

export function DialogConfigEditor({ dialogId, config, editable }: Props) {
  const [open, setOpen] = useState(false);
  const [fonts, setFonts] = useState<AllowedFontRule[]>(config?.allowed_fonts ?? []);
  const [flags, setFlags] = useState<ValidatorFlags>(
    config?.validators ?? DEFAULT_VALIDATOR_FLAGS,
  );
  const [margins, setMargins] = useState<MarginRule>(
    config?.margins ?? DEFAULT_MARGIN_RULE,
  );
  const queryClient = useQueryClient();

  // Когда меняется dialog (например, после save) — синхронизируем локальный стейт
  useEffect(() => {
    setFonts(config?.allowed_fonts ?? []);
    setFlags(config?.validators ?? DEFAULT_VALIDATOR_FLAGS);
    setMargins(config?.margins ?? DEFAULT_MARGIN_RULE);
  }, [config]);

  // Прочие ключи конфига (ignore_fonts и т.д.) — read-only JSON
  const otherKeys = useMemo(() => {
    if (!config) return null;
    const { allowed_fonts: _af, validators: _v, margins: _m, ...rest } = config;
    return rest;
  }, [config]);

  const save = useMutation({
    mutationFn: (cfg: GostConfig) => dialogsApi.updateConfig(dialogId, cfg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dialog", dialogId] });
      toast.success("Конфиг сохранён. Применится к новым версиям.");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Не удалось сохранить конфиг");
    },
  });

  if (!config) {
    return null;
  }

  const update = (idx: number, patch: Partial<AllowedFontRule>) =>
    setFonts((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) => setFonts((rows) => rows.filter((_, i) => i !== idx));
  const add = () => setFonts((rows) => [...rows, emptyRule()]);

  const onSave = () => {
    save.mutate({
      ...config,
      allowed_fonts: fonts,
      validators: flags,
      margins,
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        role="button"
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer select-none"
      >
        <CardTitle className="flex items-center justify-between text-base">
          <span>Настройки ГОСТ-проверок</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </CardTitle>
      </CardHeader>
      <div className="collapsible" data-open={open}>
        <div className="collapsible-inner">
        <CardContent className="space-y-5">
          <div>
            <Label>Активные проверки</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {VALIDATOR_TOGGLE_LABELS.map((v) => (
                <label
                  key={v.key}
                  htmlFor={`flag-${v.key}`}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/40 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{v.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {v.hint}
                    </span>
                  </span>
                  <Switch
                    id={`flag-${v.key}`}
                    checked={flags[v.key]}
                    disabled={!editable}
                    onCheckedChange={(c) =>
                      setFlags((f) => ({ ...f, [v.key]: c }))
                    }
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Шрифт-валидатор отдельно: отключается через пустой список «Допустимые шрифты».
            </p>
          </div>

          <div>
            <Label>Поля страницы (мм)</Label>
            <div className="mt-2">
              <MarginFields
                value={margins}
                onChange={setMargins}
                editable={editable && flags.margin}
              />
            </div>
            {!flags.margin && (
              <p className="mt-1 text-xs text-muted-foreground">
                Проверка полей выключена тогглом выше.
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Допустимые шрифты</Label>
              {editable && (
                <Button type="button" variant="outline" size="sm" onClick={add}>
                  <Plus className="h-3.5 w-3.5" /> Добавить
                </Button>
              )}
            </div>
            {!fonts.length ? (
              <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
                Шрифты не ограничены — FontValidator пропускает все спаны.
              </p>
            ) : (
              <div className="space-y-2">
                {fonts.map((f, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 gap-2 rounded-md border border-border/60 bg-muted/40 p-3 sm:grid-cols-[1.6fr_0.6fr_1fr_0.6fr_0.6fr_auto]"
                  >
                    <Input
                      placeholder="TimesNewRomanPSMT"
                      value={f.name}
                      readOnly={!editable}
                      onChange={(e) => update(idx, { name: e.target.value })}
                    />
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="14"
                      value={f.size}
                      readOnly={!editable}
                      onChange={(e) =>
                        update(idx, { size: Number(e.target.value) || 0 })
                      }
                    />
                    <Input
                      placeholder="0,0,0"
                      value={f.color.join(",")}
                      readOnly={!editable}
                      onChange={(e) => {
                        const parts = e.target.value
                          .split(",")
                          .map((s) => Number(s.trim()) || 0);
                        const triple: [number, number, number] = [
                          parts[0] ?? 0,
                          parts[1] ?? 0,
                          parts[2] ?? 0,
                        ];
                        update(idx, { color: triple });
                      }}
                    />
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="size tol"
                      value={f.size_tolerance ?? 0}
                      readOnly={!editable}
                      onChange={(e) =>
                        update(idx, { size_tolerance: Number(e.target.value) || 0 })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="color tol"
                      value={f.color_tolerance ?? 0}
                      readOnly={!editable}
                      onChange={(e) =>
                        update(idx, { color_tolerance: Number(e.target.value) || 0 })
                      }
                    />
                    {editable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Input
                      className="sm:col-span-6"
                      placeholder="Описание для ошибок: «Times New Roman, 14pt, чёрный»"
                      value={f.description ?? ""}
                      readOnly={!editable}
                      onChange={(e) => update(idx, { description: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Колонки: имя PostScript-шрифта, размер pt, цвет RGB, допуск по размеру, допуск по цвету.
            </p>
          </div>

          {otherKeys && (
            <div>
              <Label>Прочие ключи (read-only)</Label>
              <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs">
                {JSON.stringify(otherKeys, null, 2)}
              </pre>
            </div>
          )}

          {editable && (
            <div className="flex justify-end">
              <Button onClick={onSave} disabled={save.isPending}>
                {save.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Сохранить конфиг
              </Button>
            </div>
          )}
        </CardContent>
        </div>
      </div>
    </Card>
  );
}

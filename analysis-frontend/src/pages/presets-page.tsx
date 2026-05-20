import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Loader2,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { presetsApi } from "@/api/endpoints";
import type {
  AllowedFontRule,
  GostConfig,
  GostPreset,
  ValidatorFlags,
} from "@/api/types";
import {
  DEFAULT_MARGIN_RULE,
  DEFAULT_VALIDATOR_FLAGS,
  VALIDATOR_TOGGLE_LABELS,
} from "@/api/types";
import { MarginFields } from "@/components/margin-fields";
import { useAuth } from "@/auth/auth-store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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

function emptyConfig(): GostConfig {
  return {
    allowed_fonts: [],
    ignore_fonts: [],
    validators: { ...DEFAULT_VALIDATOR_FLAGS },
    margins: { ...DEFAULT_MARGIN_RULE },
  };
}

export function PresetsPage() {
  const role = useAuth((s) => s.role);
  const editable = role === "teacher";
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["presets"],
    queryFn: presetsApi.list,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Settings2 className="h-6 w-6 text-primary" /> ГОСТ-пресеты
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Шаблоны конфигов проверок. Студент выбирает один при создании
            диалога — конфиг копируется в диалог, дальше редактируется
            преподавателем точечно.
          </p>
        </div>
        {editable && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Новый пресет
          </Button>
        )}
      </div>

      {creating && (
        <PresetCard
          editable
          createMode
          onCancelCreate={() => setCreating(false)}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <p className="rounded-md border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
          Пресетов нет. Создайте первый, чтобы студенты могли его выбрать.
        </p>
      ) : (
        data.map((p) => <PresetCard key={p.id} preset={p} editable={editable} />)
      )}
    </div>
  );
}

interface PresetCardProps {
  preset?: GostPreset;
  editable: boolean;
  createMode?: boolean;
  onCancelCreate?: () => void;
}

function PresetCard({
  preset,
  editable,
  createMode,
  onCancelCreate,
}: PresetCardProps) {
  const [open, setOpen] = useState(!!createMode);
  const [code, setCode] = useState(preset?.code ?? "");
  const [name, setName] = useState(preset?.name ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [config, setConfig] = useState<GostConfig>(preset?.config ?? emptyConfig());
  const queryClient = useQueryClient();

  useEffect(() => {
    if (preset) {
      setCode(preset.code);
      setName(preset.name);
      setDescription(preset.description ?? "");
      setConfig(preset.config);
    }
  }, [preset]);

  const save = useMutation({
    mutationFn: () => {
      const payload = { code, name, description, config };
      return preset
        ? presetsApi.update(preset.id, payload)
        : presetsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
      toast.success(preset ? "Пресет сохранён" : "Пресет создан");
      if (createMode) onCancelCreate?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Не удалось сохранить");
    },
  });

  const remove = useMutation({
    mutationFn: () => presetsApi.remove(preset!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presets"] });
      toast.success("Пресет удалён");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? "Не удалось удалить");
    },
  });

  const fonts = config.allowed_fonts;
  const updateFont = (idx: number, patch: Partial<AllowedFontRule>) =>
    setConfig((c) => ({
      ...c,
      allowed_fonts: c.allowed_fonts.map((r, i) =>
        i === idx ? { ...r, ...patch } : r,
      ),
    }));
  const removeFont = (idx: number) =>
    setConfig((c) => ({
      ...c,
      allowed_fonts: c.allowed_fonts.filter((_, i) => i !== idx),
    }));
  const addFont = () =>
    setConfig((c) => ({ ...c, allowed_fonts: [...c.allowed_fonts, emptyRule()] }));

  const updateIgnoreFonts = (raw: string) =>
    setConfig((c) => ({
      ...c,
      ignore_fonts: raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    }));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        role="button"
        onClick={() => !createMode && setOpen((v) => !v)}
        className={createMode ? "" : "cursor-pointer select-none"}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <span className="space-x-2">
            <span>{name || "(новый пресет)"}</span>
            {code && (
              <span className="font-mono text-[11px] font-normal text-muted-foreground">
                {code}
              </span>
            )}
          </span>
          {!createMode && (
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
            />
          )}
        </CardTitle>
      </CardHeader>

      <div className="collapsible" data-open={open}>
        <div className="collapsible-inner">
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>code</Label>
              <Input
                value={code}
                readOnly={!editable}
                placeholder="gost-7.32-2017"
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input
                value={name}
                readOnly={!editable}
                placeholder="ГОСТ 7.32-2017"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Описание</Label>
            <Textarea
              value={description}
              readOnly={!editable}
              rows={2}
              placeholder="Стандартные требования к НИР"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Label>Активные проверки</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {VALIDATOR_TOGGLE_LABELS.map((v) => {
                const flags = config.validators ?? DEFAULT_VALIDATOR_FLAGS;
                return (
                  <label
                    key={v.key}
                    htmlFor={`preset-flag-${preset?.id ?? "new"}-${v.key}`}
                    className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/40 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{v.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {v.hint}
                      </span>
                    </span>
                    <Switch
                      id={`preset-flag-${preset?.id ?? "new"}-${v.key}`}
                      checked={flags[v.key]}
                      disabled={!editable}
                      onCheckedChange={(c) =>
                        setConfig((cfg) => ({
                          ...cfg,
                          validators: {
                            ...(cfg.validators ?? DEFAULT_VALIDATOR_FLAGS),
                            [v.key]: c,
                          } as ValidatorFlags,
                        }))
                      }
                    />
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Шрифт-валидатор отдельно: отключается через пустой список «Допустимые шрифты».
            </p>
          </div>

          <div>
            <Label>Поля страницы (мм)</Label>
            <div className="mt-2">
              <MarginFields
                value={config.margins}
                onChange={(next) =>
                  setConfig((cfg) => ({ ...cfg, margins: next }))
                }
                editable={
                  editable && (config.validators?.margin ?? true)
                }
              />
            </div>
            {!(config.validators?.margin ?? true) && (
              <p className="mt-1 text-xs text-muted-foreground">
                Проверка полей выключена тогглом выше.
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Допустимые шрифты</Label>
              {editable && (
                <Button type="button" variant="outline" size="sm" onClick={addFont}>
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
                      onChange={(e) => updateFont(idx, { name: e.target.value })}
                    />
                    <Input
                      type="number"
                      step="0.5"
                      value={f.size}
                      readOnly={!editable}
                      onChange={(e) =>
                        updateFont(idx, { size: Number(e.target.value) || 0 })
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
                        updateFont(idx, { color: triple });
                      }}
                    />
                    <Input
                      type="number"
                      step="0.1"
                      value={f.size_tolerance ?? 0}
                      readOnly={!editable}
                      onChange={(e) =>
                        updateFont(idx, {
                          size_tolerance: Number(e.target.value) || 0,
                        })
                      }
                    />
                    <Input
                      type="number"
                      value={f.color_tolerance ?? 0}
                      readOnly={!editable}
                      onChange={(e) =>
                        updateFont(idx, {
                          color_tolerance: Number(e.target.value) || 0,
                        })
                      }
                    />
                    {editable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFont(idx)}
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
                      onChange={(e) =>
                        updateFont(idx, { description: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Колонки: имя PostScript-шрифта, размер pt, цвет RGB, допуск по
              размеру, допуск по цвету.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>ignore_fonts (через запятую)</Label>
            <Input
              value={config.ignore_fonts.join(", ")}
              readOnly={!editable}
              placeholder="SymbolMT"
              onChange={(e) => updateIgnoreFonts(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Шрифты из этого списка исключаются из проверки (формулы, иконки).
            </p>
          </div>

          {editable && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
              <div>
                {preset && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Удалить пресет «${preset.name}»? Существующие диалоги сохранят свой конфиг.`,
                        )
                      ) {
                        remove.mutate();
                      }
                    }}
                    disabled={remove.isPending}
                  >
                    {remove.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Удалить
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {createMode && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancelCreate}
                  >
                    Отмена
                  </Button>
                )}
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !code || !name}
                >
                  {save.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {createMode ? "Создать" : "Сохранить"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        </div>
      </div>
    </Card>
  );
}

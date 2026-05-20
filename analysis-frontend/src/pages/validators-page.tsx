import {
  AlignLeft,
  BookOpen,
  Hash,
  Image as ImageIcon,
  List,
  ListTree,
  Square,
  Type,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ValidatorInfo {
  id: string;
  name: string;
  icon: typeof BookOpen;
  what: string;
  rules: string[];
  configurable: string;
}

const VALIDATORS: ValidatorInfo[] = [
  {
    id: "FontValidator",
    name: "Шрифт, кегль, цвет",
    icon: Type,
    what: "Проверяет, что каждый текстовый фрагмент использует разрешённый шрифт нужного размера и цвета.",
    rules: [
      "Имя PostScript-шрифта должно совпадать с одним из allowed_fonts.",
      "Размер должен попадать в [size − size_tolerance, size + size_tolerance].",
      "Цвет RGB допускает отклонение color_tolerance по каждому каналу.",
      "Пустой allowed_fonts отключает валидатор полностью.",
    ],
    configurable: "Настраивается в конфиге диалога: список allowed_fonts + ignore_fonts.",
  },
  {
    id: "PageNumberValidator",
    name: "Нумерация страниц",
    icon: Hash,
    what: "Проверяет соответствие нумерации страниц требованиям ГОСТ.",
    rules: [
      "Номера должны идти подряд без пропусков и дубликатов.",
      "Титульный лист не нумеруется, но входит в общий счёт.",
      "Расположение номера — в нижней части страницы по центру.",
    ],
    configurable: "Не имеет настроек — фиксированные правила ГОСТ 7.32-2017.",
  },
  {
    id: "FigureCaptionValidator",
    name: "Подписи рисунков",
    icon: ImageIcon,
    what: "Проверяет формат и расположение подписей под рисунками.",
    rules: [
      "Подпись начинается с «Рисунок N — » или «Рисунок N.M — » (для подразделов).",
      "Подпись располагается под рисунком по центру.",
      "Нумерация сквозная или в пределах раздела (определяется по первой встрече).",
    ],
    configurable: "Не имеет настроек.",
  },
  {
    id: "TocValidator",
    name: "Оглавление",
    icon: ListTree,
    what: "Проверяет согласованность оглавления и фактического содержания документа.",
    rules: [
      "Каждый заголовок из оглавления должен встречаться в документе на указанной странице.",
      "Порядок и иерархия заголовков должны совпадать.",
      "Номера разделов из оглавления должны быть консистентны.",
    ],
    configurable: "Не имеет настроек.",
  },
  {
    id: "StructuralHeadingValidator",
    name: "Заголовки разделов",
    icon: AlignLeft,
    what: "Проверяет оформление заголовков структурных элементов работы.",
    rules: [
      'Обязательные разделы: «Введение», «Заключение», «Список использованных источников».',
      "Заголовки верхнего уровня — с новой страницы, прописными буквами.",
      "Подзаголовки нумеруются (1.1, 1.2, …) и не дублируются.",
    ],
    configurable: "Не имеет настроек.",
  },
  {
    id: "MarginValidator",
    name: "Поля страницы",
    icon: Square,
    what: "Проверяет, что поля страниц соответствуют ГОСТ 7.32-2017: левое 30 мм, правое 15 мм, верх и низ по 20 мм.",
    rules: [
      "Поля вычисляются по фактическому положению текста (PDF не хранит их в метаданных).",
      "Колонтитулы и номера страниц исключаются из расчёта через настраиваемые «полосы игнорирования» сверху/снизу.",
      "Допуск ±N мм на каждую сторону задаётся в конфиге.",
      "Одна ошибка на страницу: все четыре стороны суммируются в одно сообщение.",
    ],
    configurable:
      "Настраивается: значения сторон в мм, допуск, размеры полос игнора. Дефолт — 30/15/20/20 мм, допуск ±2 мм.",
  },
  {
    id: "ListValidator",
    name: "Перечисления (списки)",
    icon: List,
    what: "Проверяет оформление маркированных и нумерованных списков по ГОСТ 7.32-2017.",
    rules: [
      "Маркер по умолчанию — тире «–» (en/em dash или дефис).",
      "Буквенный пункт — строчная русская буква со скобкой: «а)», «б)», «в)».",
      "Числовой пункт — арабская цифра со скобкой: «1)», «2)», «3)».",
      "Ловит: «*» / «•» / другие буллеты, латиницу («a)»), прописные буквы, точку вместо скобки («1.», «а.»).",
      "Чтобы не путать с заголовком вида «1. Введение», требуется ≥2 подряд идущих линий с похожим отступом.",
    ],
    configurable: "Не имеет настроек — фиксированные правила ГОСТ.",
  },
];

export function ValidatorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BookOpen className="h-6 w-6 text-primary" /> Автоматические ГОСТ-проверки
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Каждая загруженная версия работы прогоняется через эти валидаторы.
          Найденные несоответствия попадают в отчёт сабмишена и блокируют
          system-approval, если хотя бы один из валидаторов нашёл ошибку.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {VALIDATORS.map((v) => {
          const Icon = v.icon;
          return (
            <Card key={v.id} className="overflow-hidden">
              <div className="h-1 w-full bg-primary/70" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    {v.name}
                    <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
                      {v.id}
                    </span>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{v.what}</p>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Что проверяет
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-foreground">
                    {v.rules.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {v.configurable}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

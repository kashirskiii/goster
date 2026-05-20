import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Loader2, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import { checkErrorsApi } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkErrorId: string;
  page: number | null;
}

export function ErrorSnippetDialog({
  open,
  onOpenChange,
  checkErrorId,
  page,
}: Props) {
  // Грузим только когда открыто; результат — object URL, кэшируется react-query.
  const query = useQuery({
    queryKey: ["snippet", checkErrorId],
    queryFn: () => checkErrorsApi.snippetObjectUrl(checkErrorId),
    enabled: open,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });

  // При размонтировании / смене URL освобождаем object URL.
  useEffect(() => {
    const url = query.data;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [query.data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Фрагмент страницы {page ?? "—"}
          </DialogTitle>
          <DialogDescription>
            Красная рамка отмечает место, на которое указал валидатор.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-[200px] items-center justify-center rounded-md border border-border/60 bg-muted/30 p-3">
          {query.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Рендер…
            </div>
          ) : query.isError ? (
            <div className="text-sm text-destructive">
              Не удалось загрузить фрагмент
            </div>
          ) : query.data ? (
            <img
              src={query.data}
              alt={`Снимок страницы ${page ?? ""}`}
              className="max-h-[70vh] w-auto rounded shadow-soft"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Кнопка-триггер, открывает модалку со снимком. */
export function ErrorSnippetTrigger({
  checkErrorId,
  page,
}: {
  checkErrorId: string;
  page: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <ZoomIn className="h-3.5 w-3.5" />
        Показать на странице
      </Button>
      <ErrorSnippetDialog
        open={open}
        onOpenChange={setOpen}
        checkErrorId={checkErrorId}
        page={page}
      />
    </>
  );
}

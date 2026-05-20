import { useMutation } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { filesApi } from "@/api/endpoints";
import { Button, type ButtonProps } from "@/components/ui/button";

interface Props extends Omit<ButtonProps, "onClick"> {
  fileId: string;
  fileName: string;
  /** Если задан — он показывается в кнопке вместо иконки. */
  label?: string;
}

export function DownloadFileButton({ fileId, fileName, label, ...buttonProps }: Props) {
  const download = useMutation({
    mutationFn: () => filesApi.download(fileId, fileName),
    onError: (err: any) => {
      const status = err?.response?.status;
      toast.error(
        status === 403 ? "Нет доступа к файлу" : status === 404 ? "Файл не найден" : "Не удалось скачать",
      );
    },
  });

  return (
    <Button
      variant="outline"
      size={label ? "sm" : "icon"}
      type="button"
      title={`Скачать ${fileName}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        download.mutate();
      }}
      disabled={download.isPending}
      {...buttonProps}
    >
      {download.isPending ? <Loader2 className="animate-spin" /> : <Download />}
      {label}
    </Button>
  );
}

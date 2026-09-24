"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { updateChatTemplatesAction } from "@/lib/actions/settings";
import {
  chatTemplatesSchema,
  type ChatTemplatesInput,
} from "@/lib/validations/settings";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  INVOICE_TEMPLATE_PLACEHOLDERS,
  REPORT_TEMPLATE_PLACEHOLDERS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SubmitButton } from "@/components/shared/submit-button";

function PlaceholderHint({ names }: { names: readonly string[] }) {
  return (
    <p className="text-xs text-muted-foreground">
      Placeholder:{" "}
      {names.map((n) => (
        <code key={n} className="mx-0.5 rounded bg-muted px-1">
          {"{{" + n + "}}"}
        </code>
      ))}
    </p>
  );
}

export function ChatTemplatesForm({
  initial,
}: {
  initial: { invoice: string; report: string };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<ChatTemplatesInput>({
    resolver: zodResolver(chatTemplatesSchema) as unknown as Resolver<ChatTemplatesInput>,
    defaultValues: {
      message_template_invoice: initial.invoice,
      message_template_report: initial.report,
    },
  });

  async function onSubmit(values: ChatTemplatesInput) {
    setPending(true);
    const result = await updateChatTemplatesAction(values);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Format chat disimpan.");
    router.refresh();
  }

  function resetDefaults() {
    form.setValue("message_template_invoice", DEFAULT_MESSAGE_TEMPLATES.invoice);
    form.setValue("message_template_report", DEFAULT_MESSAGE_TEMPLATES.report);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <FormField
            control={form.control}
            name="message_template_invoice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Format tagihan pembayaran</FormLabel>
                <FormControl>
                  <Textarea rows={7} className="font-mono text-xs" {...field} />
                </FormControl>
                <PlaceholderHint names={INVOICE_TEMPLATE_PLACEHOLDERS} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <FormField
            control={form.control}
            name="message_template_report"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Format laporan belajar murid</FormLabel>
                <FormControl>
                  <Textarea rows={7} className="font-mono text-xs" {...field} />
                </FormControl>
                <PlaceholderHint names={REPORT_TEMPLATE_PLACEHOLDERS} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={resetDefaults}>
            <RotateCcw className="size-4" /> Kembalikan Default
          </Button>
          <SubmitButton pending={pending} loadingText="Menyimpan...">
            Simpan Format Chat
          </SubmitButton>
        </div>
      </form>
    </Form>
  );
}

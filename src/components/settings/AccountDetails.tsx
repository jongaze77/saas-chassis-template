import { formatDate } from "@/lib/formatters";

interface AccountDetailsProps {
  accountName: string;
  createdAt: Date;
}

export function AccountDetails({ accountName, createdAt }: AccountDetailsProps) {
  return (
    <dl className="space-y-4">
      <div>
        <dt className="text-sm font-medium text-muted-foreground">Account name</dt>
        <dd className="mt-1 text-sm">{accountName}</dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-muted-foreground">Created</dt>
        <dd className="mt-1 text-sm">{formatDate(createdAt)}</dd>
      </div>
    </dl>
  );
}

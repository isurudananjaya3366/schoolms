"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PenLine, CheckCircle2, XCircle } from "lucide-react";

interface SignatureOptions {
  classTeacherSign: boolean;
  principalSign: boolean;
  vicePrincipalSign: boolean;
}

interface SignatureSelectorProps {
  signatureOptions: SignatureOptions;
  onSignatureOptionsChange: (options: SignatureOptions) => void;
  availableSignatures: {
    hasClassTeacher: boolean;
    hasPrincipal: boolean;
    hasVicePrincipal: boolean;
  };
}

export default function SignatureSelector({
  signatureOptions,
  onSignatureOptionsChange,
  availableSignatures,
}: SignatureSelectorProps) {
  const toggle = (key: keyof SignatureOptions) => {
    onSignatureOptionsChange({
      ...signatureOptions,
      [key]: !signatureOptions[key],
    });
  };

  const signatureItems = [
    {
      key: "classTeacherSign" as const,
      label: "Class Teacher",
      available: availableSignatures.hasClassTeacher,
    },
    {
      key: "principalSign" as const,
      label: "Principal",
      available: availableSignatures.hasPrincipal,
    },
    {
      key: "vicePrincipalSign" as const,
      label: "Vice Principal",
      available: availableSignatures.hasVicePrincipal,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="h-4 w-4" />
          Signatures
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Select which signatures to include in the report. Upload signatures in Settings.
        </p>
        {signatureItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`sig-${item.key}`}
                checked={signatureOptions[item.key]}
                onChange={() => toggle(item.key)}
                className="h-4 w-4 rounded border-gray-300 accent-[var(--color-primary)]"
              />
              <Label
                htmlFor={`sig-${item.key}`}
                className="text-sm cursor-pointer"
              >
                {item.label}
              </Label>
            </div>
            {item.available ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-700">
                <CheckCircle2 className="h-3 w-3" />
                Available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <XCircle className="h-3 w-3" />
                Not uploaded
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

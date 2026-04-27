"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PenLine, CheckCircle2, XCircle } from "lucide-react";

interface SignatureOptions {
  classTeacherField: boolean;
  classTeacherDigital: boolean;
  principalField: boolean;
  principalDigital: boolean;
  vicePrincipalField: boolean;
  vicePrincipalDigital: boolean;
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
  const signatureItems = [
    {
      fieldKey: "classTeacherField" as const,
      digitalKey: "classTeacherDigital" as const,
      label: "Class Teacher",
      available: availableSignatures.hasClassTeacher,
    },
    {
      fieldKey: "principalField" as const,
      digitalKey: "principalDigital" as const,
      label: "Principal",
      available: availableSignatures.hasPrincipal,
    },
    {
      fieldKey: "vicePrincipalField" as const,
      digitalKey: "vicePrincipalDigital" as const,
      label: "Vice Principal",
      available: availableSignatures.hasVicePrincipal,
    },
  ];

  const toggleField = (fieldKey: keyof SignatureOptions, digitalKey: keyof SignatureOptions) => {
    const newFieldValue = !signatureOptions[fieldKey];
    onSignatureOptionsChange({
      ...signatureOptions,
      [fieldKey]: newFieldValue,
      // Auto-uncheck digital when field is unchecked
      ...(newFieldValue ? {} : { [digitalKey]: false }),
    });
  };

  const toggleDigital = (digitalKey: keyof SignatureOptions) => {
    onSignatureOptionsChange({
      ...signatureOptions,
      [digitalKey]: !signatureOptions[digitalKey],
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="h-4 w-4" />
          Signatures
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Select which signatures to include in the report. Upload signatures in Settings.
        </p>
        {signatureItems.map((item) => {
          const fieldChecked = signatureOptions[item.fieldKey];
          const digitalDisabled = !fieldChecked || !item.available;

          return (
            <div key={item.fieldKey} className="space-y-1.5">
              {/* Role header row */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.label}</span>
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

              {/* Sub-checkboxes */}
              <div className="ml-6 space-y-1">
                {/* Show signature field */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`sig-field-${item.fieldKey}`}
                    checked={fieldChecked}
                    onChange={() => toggleField(item.fieldKey, item.digitalKey)}
                    className="h-4 w-4 rounded border-gray-300 accent-[var(--color-primary)]"
                  />
                  <Label
                    htmlFor={`sig-field-${item.fieldKey}`}
                    className="text-sm cursor-pointer"
                  >
                    Show signature field
                  </Label>
                </div>

                {/* Use digital signature */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`sig-digital-${item.digitalKey}`}
                    checked={digitalDisabled ? false : signatureOptions[item.digitalKey]}
                    onChange={() => toggleDigital(item.digitalKey)}
                    disabled={digitalDisabled}
                    className={`h-4 w-4 rounded border-gray-300 accent-[var(--color-primary)] ${digitalDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  />
                  <Label
                    htmlFor={`sig-digital-${item.digitalKey}`}
                    className={`text-sm ${digitalDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    Use digital signature
                  </Label>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

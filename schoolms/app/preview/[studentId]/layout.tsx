import "@/app/globals.css";
import "./print.css";

export const metadata = {
  title: "Preview Mode | SchoolMS",
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}

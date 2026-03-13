import "@/app/globals.css";
import "./print.css";

export const metadata = {
  title: "Class Presenter | SchoolMS",
};

export default function SessionLayout({
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

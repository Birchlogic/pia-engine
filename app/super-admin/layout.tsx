import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Super Admin | K&S DIGIPROTECT",
    description: "Super Admin Management Console",
};

export default function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}

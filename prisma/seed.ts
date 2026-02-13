import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding database...");

    // Create users
    const adminPassword = await hash("password123", 12);
    const analystPassword = await hash("password123", 12);

    const admin = await prisma.user.upsert({
        where: { email: "admin@kaizen.ai" },
        create: {
            email: "admin@kaizen.ai",
            name: "Lalit Mohan Joshi",
            password: adminPassword,
            role: "senior_assessor",
        },
        update: {
            name: "Lalit Mohan Joshi",
        },
    });

    const analyst = await prisma.user.upsert({
        where: { email: "analyst@kaizen.ai" },
        update: {},
        create: {
            email: "analyst@kaizen.ai",
            name: "Privacy Analyst",
            password: analystPassword,
            role: "analyst",
        },
    });

    console.log("✅ Users created:", admin.email, analyst.email);

    // Create a demo organization
    const org = await prisma.organization.upsert({
        where: { id: "demo-org-001" },
        update: {},
        create: {
            id: "demo-org-001",
            name: "TechCorp India Pvt Ltd",
            industry: "Technology",
            jurisdiction: "India",
            regulatoryScope: ["DPDPA", "GDPR"],
            sizeBand: "medium",
            createdById: admin.id,
        },
    });

    console.log("✅ Organization created:", org.name);

    // Create a demo project
    const project = await prisma.project.upsert({
        where: { id: "demo-project-001" },
        update: {},
        create: {
            id: "demo-project-001",
            orgId: org.id,
            name: "DPDPA Compliance Assessment 2026",
            description:
                "Complete Privacy Impact Assessment for DPDPA compliance across all business verticals.",
            applicableRegulations: ["DPDPA", "IT Act"],
            assessmentType: "full_pia",
            targetCompletionDate: new Date("2026-06-30"),
            status: "in_progress",
            createdById: admin.id,
        },
    });

    console.log("✅ Project created:", project.name);

    // Create default verticals
    const verticals = [
        { name: "Human Resources", headName: "Priya Sharma", headRole: "VP HR" },
        { name: "Finance & Accounting", headName: "Rajesh Kumar", headRole: "CFO" },
        { name: "Engineering / Product", headName: "Amit Patel", headRole: "CTO" },
        { name: "Customer Care / Support", headName: "Neha Gupta", headRole: "Head of Support" },
        { name: "Sales & Marketing", headName: "Vikram Singh", headRole: "CMO" },
    ];

    for (let i = 0; i < verticals.length; i++) {
        await prisma.vertical.upsert({
            where: { id: `demo-vertical-${i}` },
            update: {},
            create: {
                id: `demo-vertical-${i}`,
                projectId: project.id,
                name: verticals[i].name,
                headName: verticals[i].headName,
                headRole: verticals[i].headRole,
                sortOrder: i,
                assessmentStatus: i === 0 ? "in_progress" : "not_started",
                createdById: admin.id,
            },
        });
    }

    console.log("✅ Verticals created:", verticals.length);

    // Create a sample session for HR vertical
    await prisma.interviewSession.upsert({
        where: { id: "demo-session-001" },
        update: {},
        create: {
            id: "demo-session-001",
            verticalId: "demo-vertical-0",
            sessionDate: new Date("2026-02-10T10:00:00Z"),
            sessionNumber: 1,
            durationMinutes: 45,
            interviewerNames: ["Lalit Mohan Joshi"],
            intervieweeNames: ["Priya Sharma"],
            intervieweeRoles: ["VP HR"],
            assessmentCriteriaTags: ["data_collection", "data_storage", "access_controls", "retention_deletion"],
            status: "finalized",
            rawTextNotes: `Interview with Priya Sharma, VP HR at TechCorp India.

Key findings from the HR vertical assessment:

1. Employee Data Collection:
- HR collects employee personal data including full name, email, phone number, Aadhaar number, PAN card, bank account details, and emergency contact information
- Data is collected through the onboarding portal (BambooHR) and manual paper forms
- Employee health records including insurance claims are processed through the health insurance partner (ICICI Lombard)

2. Systems Used:
- BambooHR for core HR management
- SAP SuccessFactors for performance management
- Zoho People for attendance tracking
- Google Workspace for general communication
- Shared Google Drive for document storage (including offer letters, appraisals)

3. Access Controls:
- HR team (5 members) has full access to all employee records
- Managers can view their direct reports' basic info and performance data
- IT admin has backend access to BambooHR
- No formal access review process exists

4. Data Sharing:
- Employee salary data shared with payroll provider (ADP India)
- Health records shared with insurance provider (ICICI Lombard)
- Background verification data shared with AuthBridge
- Employee data shared with external auditors during annual audit

5. Retention:
- No formal retention policy documented
- Employee records kept indefinitely after separation
- Priya mentioned "we probably should delete things after people leave but no one has set that up"

6. Cross-Border:
- BambooHR is US-hosted (data stored in US data centers)
- Google Workspace data also in US
- No data processing agreement or standard contractual clauses in place for these transfers

7. Consent:
- Employees sign a generic consent form during onboarding
- No granular consent for specific processing activities
- No mechanism for employees to withdraw consent
- Priya was uncertain about DPDPA requirements for employee data`,
            aiSummary: null,
            createdById: admin.id,
        },
    });

    console.log("✅ Sample session created for HR vertical");
    console.log("\n🎉 Seeding complete! Login with: admin@kaizen.ai / password123");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

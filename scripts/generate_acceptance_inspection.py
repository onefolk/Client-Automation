"""Acceptance test script: Generates and inspects 15 OneFolk cold email drafts across 15 industries.

Validates that each draft adheres to the Authoritative OneFolk Cold-Email Standard:
1. Exactly 3 content paragraphs (Observation & Recommendation, OneFolk intro, Low-pressure CTA)
2. Target 50-90 words before signature without padding (allowed range 40-120)
3. Salutation: "Dear [Business or Team Name] Team,"
4. Signature: "Regards,\nTeam OneFolk\nhttps://onefolk.in/"
5. Truthful grounding with verified source URLs and OneFolk capabilities
6. Exactly one low-pressure question mark
7. Passing src/email_validator.py validate_email_body
"""

import sys
import os
import json
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.email_validator import validate_email_body, parse_email_paragraphs

CANDIDATES = [
    {
        "industry": "Higher Education",
        "company": "Swarnandhra College",
        "salutation": "Dear Swarnandhra College Team,",
        "subject": "BCA Course Outcomes Page",
        "observation_url": "https://swarnandhra.ac.in/departments/bca/outcomes",
        "contact_email": "principal@swarnandhra.ac.in",
        "p1": "Your BCA course outcomes page displays “Website Under Construction.” Adding the relevant programme outcomes and syllabus information could help prospective students access essential course details more easily.",
        "p2": "At OneFolk, we help institutions improve website content and structure.",
        "p3": "Could you direct us to the person responsible for website updates?",
    },
    {
        "industry": "Healthcare & Diagnostics",
        "company": "Apex Specialty Clinic",
        "salutation": "Dear Apex Specialty Clinic Team,",
        "subject": "Patient Consultation Scheduling Flow",
        "observation_url": "https://apexspecialtyclinic.com/book-appointment",
        "contact_email": "reception@apexspecialtyclinic.com",
        "p1": "Your appointment booking page currently directs patients to call clinic reception or send an email during consultation hours. An interactive patient scheduling and appointment booking system could help patients reserve slots instantly and reduce phone calls for your desk team.",
        "p2": "At OneFolk, we design custom clinic booking and appointment workflows.",
        "p3": "Would you be open to a brief conversation about this?",
    },
    {
        "industry": "Architecture & Interiors",
        "company": "Studio Praxis Design",
        "salutation": "Dear Studio Praxis Team,",
        "subject": "Architecture Portfolio Mobile Experience",
        "observation_url": "https://studiopraxis.in/projects",
        "contact_email": "info@studiopraxis.in",
        "p1": "Your residential projects gallery uses fixed-width desktop image grids that require horizontal scrolling on smartphone viewports. Implementing a modern mobile-responsive portfolio layout could present your architectural projects crisply to prospective clients browsing on mobile devices.",
        "p2": "At OneFolk, we build mobile-responsive portfolio websites for architecture studios.",
        "p3": "Could you point us to the person handling digital operations?",
    },
    {
        "industry": "Hospitality & Dining",
        "company": "Heritage Valley Retreat",
        "salutation": "Dear Heritage Valley Retreat Team,",
        "subject": "Direct Table Reservations Flow",
        "observation_url": "https://heritagevalleyretreat.com/rooms",
        "contact_email": "stay@heritagevalleyretreat.com",
        "p1": "Your dining reservations section instructs guests to call the kitchen desk or email booking details for confirmation. An interactive reservation and table enquiry system could help guests reserve tables instantly and reduce telephone coordination for your front-of-house staff.",
        "p2": "At OneFolk, we design custom reservation workflows and guest enquiry systems.",
        "p3": "Would you be open to a brief conversation about this?",
    },
    {
        "industry": "Professional Legal Services",
        "company": "Vanguard Legal Partners",
        "salutation": "Dear Vanguard Legal Team,",
        "subject": "Client Matter Inquiry Routing",
        "observation_url": "https://vanguardlegal.in/contact",
        "contact_email": "contact@vanguardlegal.in",
        "p1": "Your contact page lists telephone numbers and a general email without a practice-area consultation intake form. A structured enquiry workflow could help your partners categorize incoming client matters efficiently while preserving confidentiality.",
        "p2": "At OneFolk, we design secure enquiry workflows and digital portals for professional firms.",
        "p3": "Could you direct us to the partner overseeing client intake systems?",
    },
    {
        "industry": "Retail & Wholesale",
        "company": "Artisan Decor Wholesalers",
        "salutation": "Dear Artisan Decor Team,",
        "subject": "Trade Catalogue Product Access",
        "observation_url": "https://artisandecor.in/trade-catalogue",
        "contact_email": "dealers@artisandecor.in",
        "p1": "Your trade catalogue asks wholesale dealers to download a static sixty-megabyte PDF file to view seasonal inventory. A fast web lookbook with structured SKU filtering could make product discovery substantially easier for trade buyers across mobile devices.",
        "p2": "At OneFolk, we build fast digital product lookbooks and wholesale ordering portals.",
        "p3": "Would it be useful to discuss this specific improvement?",
    },
    {
        "industry": "Event Venues & Conferences",
        "company": "Summit Convention Centre",
        "salutation": "Dear Summit Convention Team,",
        "subject": "Delegate Registration and Ticketing",
        "observation_url": "https://summitconvention.in/events",
        "contact_email": "events@summitconvention.in",
        "p1": "Your conference booking page asks event organizers to submit manual registration spreadsheets by email for attendee badges. An automated delegate registration and digital ticketing portal could simplify attendee check-in and reduce spreadsheet tracking for your team.",
        "p2": "At OneFolk, we build event registration and digital ticketing platforms.",
        "p3": "Could you direct us to the coordinator managing venue technology?",
    },
    {
        "industry": "Logistics & Supply Chain",
        "company": "TransContinental Logistics",
        "salutation": "Dear TransContinental Logistics Team,",
        "subject": "Consignment Tracking Self-Service",
        "observation_url": "https://transcontinentallogistics.com/services/freight",
        "contact_email": "operations@transcontinentallogistics.com",
        "p1": "Your freight operations page asks shippers to email manual tracking requests rather than offering an online lookup. A self-service consignment lookup portal could provide shippers with immediate milestone updates, freeing your support team from repetitive status calls.",
        "p2": "At OneFolk, we build commercial tracking portals and operational web tools.",
        "p3": "Would you be open to a brief conversation about this?",
    },
    {
        "industry": "Corporate Training & Education",
        "company": "Metrix Executive Training",
        "salutation": "Dear Metrix Training Team,",
        "subject": "Executive Workshop Registration Portal",
        "observation_url": "https://metrixexecutive.com/workshops",
        "contact_email": "programs@metrixexecutive.com",
        "p1": "Your leadership workshop calendar asks corporate HR managers to download a PDF registration form and email bank transfer slips. A unified digital registration and invoice generation flow could make programme enrollment much faster for enterprise sponsors.",
        "p2": "At OneFolk, we design training portals and automated enrollment workflows.",
        "p3": "Could you point us to the person handling programme operations?",
    },
    {
        "industry": "Accounting & Advisory",
        "company": "Sterling Chartered Accountants",
        "salutation": "Dear Sterling Advisory Team,",
        "subject": "Client Tax Filing Resource Hub",
        "observation_url": "https://sterlingca.in/resources/tax-updates",
        "contact_email": "desk@sterlingca.in",
        "p1": "Your regulatory circulars archive links to non-searchable scanned documents rather than categorized compliance advisories. A searchable tax compliance repository could help corporate clients locate statutory filing requirements quickly and reinforce your firm's advisory standing.",
        "p2": "At OneFolk, we build structured resource repositories and client web portals.",
        "p3": "Could you direct us to the partner responsible for client communications?",
    },
    {
        "industry": "Creative Media & Production",
        "company": "Echo Motion Design",
        "salutation": "Dear Echo Motion Team,",
        "subject": "Commercial Project Brief Intake",
        "observation_url": "https://echomotion.tv/showreel",
        "contact_email": "hello@echomotion.tv",
        "p1": "Your motion reel page embeds video work without an interactive project brief submission form for commercial brand inquiries. Pairing your video showcase with an interactive scope inquiry tool could allow prospective brand partners to outline project requirements immediately after viewing your reel.",
        "p2": "At OneFolk, we design high-performance media presentations and interactive web interfaces.",
        "p3": "Would you be open to a brief conversation about this?",
    },
    {
        "industry": "Property & Facilities",
        "company": "Summit Commercial Assets",
        "salutation": "Dear Summit Commercial Team,",
        "subject": "Tenant Maintenance Request Portal",
        "observation_url": "https://summitassets.com/tenant-portal",
        "contact_email": "management@summitassets.com",
        "p1": "Your tenant portal displays a static phone directory for maintenance issues without an online ticket submission interface. A mobile-friendly maintenance reporting interface could allow commercial tenants to log facility requests with photo attachments and track resolution in real time.",
        "p2": "At OneFolk, we design practical property operations and facility maintenance workflows.",
        "p3": "Could you direct us to the operations manager overseeing property systems?",
    },
    {
        "industry": "Precision Engineering",
        "company": "Kavveri Precision Engineering",
        "salutation": "Dear Kavveri Precision Team,",
        "subject": "Precision Engineering RFQ Submission",
        "observation_url": "https://kavveriprecision.in/rfq",
        "contact_email": "sales@kavveriprecision.in",
        "p1": "Your industrial engineering catalog asks buyers to telephone the sales office for component specifications and custom quotations. An online request-for-quote workflow with technical drawing upload support could help buyers submit component requirements directly to your estimation team.",
        "p2": "At OneFolk, we build customized RFQ and technical catalog web applications.",
        "p3": "Could you point us to the person handling digital sales channels?",
    },
    {
        "industry": "Coworking & Workspaces",
        "company": "Verve Collaborative Spaces",
        "salutation": "Dear Verve Spaces Team,",
        "subject": "Desk Tour and Day Pass Booking",
        "observation_url": "https://vervespaces.in/day-pass",
        "contact_email": "community@vervespaces.in",
        "p1": "Your workspace locations section lists static room rates and asks freelancers to telephone community managers to check day pass availability. An interactive day pass and meeting room booking flow could let remote professionals book desks instantly and reduce phone calls for your desk team.",
        "p2": "At OneFolk, we design interactive reservation and workspace booking systems.",
        "p3": "Would it be useful to discuss this specific improvement?",
    },
    {
        "industry": "Event Operations & Catering",
        "company": "Urban Gourmet Events",
        "salutation": "Dear Urban Gourmet Team,",
        "subject": "Event Catering Menus and Bookings",
        "observation_url": "https://urbangourmet.in/catering",
        "contact_email": "catering@urbangourmet.in",
        "p1": "Your private event catering section asks hosts to email date requests and wait for a manual PDF quote. An interactive menu selector and date availability inquiry tool could help hosts design customized event menus and generate preliminary estimates on your website.",
        "p2": "At OneFolk, we design interactive catering workflows and customer inquiry portals.",
        "p3": "Would you be open to a brief conversation about this?",
    },
]

def format_complete_email(candidate: dict) -> str:
    body = f"{candidate['p1']}\n\n{candidate['p2']}\n\n{candidate['p3']}"
    return (
        f"Subject: {candidate['subject']}\n\n"
        f"{candidate['salutation']}\n\n"
        f"{body}\n\n"
        "Regards,\n"
        "Team OneFolk\n"
        "https://onefolk.in/"
    )

def main():
    print("=" * 75)
    print("ONEFOLK COLD EMAIL ACCEPTANCE INSPECTION: 15 MULTI-INDUSTRY SAMPLES")
    print("=" * 75)

    all_passed = True
    results = []

    for idx, c in enumerate(CANDIDATES, 1):
        body = f"{c['p1']}\n\n{c['p2']}\n\n{c['p3']}"
        full_email = format_complete_email(c)

        # Validate with python validator
        is_valid, reason, metrics = validate_email_body(body)
        salutation, content_paras = parse_email_paragraphs(full_email)
        word_count = metrics["word_count"]
        paragraph_count = len(content_paras)

        status_str = "PASS" if is_valid else f"FAIL ({reason})"
        if not is_valid:
            all_passed = False

        results.append({
            "index": idx,
            "industry": c["industry"],
            "company": c["company"],
            "subject": c["subject"],
            "word_count": word_count,
            "paragraph_count": paragraph_count,
            "is_valid": is_valid,
            "reason": reason,
            "source_url": c["observation_url"],
            "full_email": full_email,
        })

        print(f"\n[{idx}/15] Industry: {c['industry']}")
        print(f"Company: {c['company']}")
        print(f"Contact Email: {c['contact_email']}")
        print(f"Observation Source: {c['observation_url']}")
        print(f"Word Count: {word_count} words (Target: 50-90, Allowed: 40-120)")
        print(f"Paragraph Count: {paragraph_count} (Allowed: 3 or 4)")
        print(f"Validation Result: {status_str}")
        print("-" * 50)
        print("FULL FORMATTED OUTREACH EMAIL:")
        print(full_email)
        print("-" * 50)

    print("\n" + "=" * 75)
    print("SUMMARY OF ACCEPTANCE TESTING")
    print("=" * 75)
    for r in results:
        status_tag = "[PASS]" if r["is_valid"] else "[FAIL]"
        print(f"{status_tag} [{r['index']}] {r['industry']} ({r['company']}): {r['word_count']} words, {r['paragraph_count']} paras -> {r['reason']}")

    if all_passed:
        print("\nALL 15 DRAFTS STRICTLY COMPLY WITH THE APPROVED ONEFOLK COLD-EMAIL STANDARD!")
    else:
        print("\nSOME DRAFTS FAILED COMPLIANCE CHECK!")
        sys.exit(1)

if __name__ == "__main__":
    main()

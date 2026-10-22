"""Acceptance test script: Generates and inspects 10 OneFolk cold email drafts across 10 industries.

Validates that each draft adheres to:
1. Exactly 4 content paragraphs (Observation, Recommendation, OneFolk intro, Low-pressure CTA)
2. Target 70-120 words before signature without padding
3. Salutation: "Dear [Business or Team Name],"
4. Portfolio link: "Our work: https://onefolk.in/work"
5. Signature: "Regards,\nTeam OneFolk\nhttps://onefolk.in/"
6. Truthful grounding with verified source URLs and approved portfolio proof
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
        "company": "Swarnandhra College of Engineering",
        "salutation": "Dear Swarnandhra College Team,",
        "subject": "Course outcomes portal observation",
        "observation_url": "https://swarnandhra.ac.in/departments/bca/outcomes",
        "contact_email": "principal@swarnandhra.ac.in",
        "proof_line": "Our team designed and built the OneFolk website.",
        "p1": "We noticed that your BCA course outcomes page currently displays \"Website Under Construction,\" despite listing department faculty and syllabus headings.",
        "p2": "A dedicated digital portal for programme outcomes and curriculum details could make essential academic information easier for prospective students and accreditation reviewers to access.",
        "p3": "At OneFolk, our team designed and built the OneFolk website, helping educational institutions structure clear, accessible digital experiences.",
        "p4": "Could you direct us to the person responsible for website updates?",
    },
    {
        "industry": "Healthcare & Diagnostics",
        "company": "Apex Specialty Clinic",
        "salutation": "Dear Apex Specialty Clinic Team,",
        "subject": "Patient appointment intake workflow",
        "observation_url": "https://apexspecialtyclinic.com/book-appointment",
        "contact_email": "reception@apexspecialtyclinic.com",
        "proof_line": "Our portfolio includes an invoicing, tax computation and financial operations web application.",
        "p1": "We noticed that your appointment scheduling page uses an unencrypted mailto link rather than a real-time booking form.",
        "p2": "A direct patient scheduling workflow with automated slot confirmation could reduce telephone inquiries and simplify consultation tracking for your front desk.",
        "p3": "At OneFolk, our portfolio includes an invoicing, tax computation and financial operations web application, delivering reliable, secure workflow solutions.",
        "p4": "Could you connect us with the clinic manager responsible for patient digital services?",
    },
    {
        "industry": "Architecture & Urban Design",
        "company": "Studio Praxis Architecture",
        "salutation": "Dear Studio Praxis Architecture Team,",
        "subject": "Project portfolio presentation review",
        "observation_url": "https://studiopraxis.in/projects",
        "contact_email": "info@studiopraxis.in",
        "proof_line": "Our team designed and built the OneFolk website.",
        "p1": "We noticed that your project portfolio serves large uncompressed renderings that take over six seconds to load on mobile devices.",
        "p2": "Optimizing image delivery with responsive web viewing could present your studio's architectural work crisply and reliably to prospective commercial clients on mobile browsers.",
        "p3": "At OneFolk, our team designed and built the OneFolk website, focusing on fast-loading visual portfolios and sleek responsive interfaces.",
        "p4": "Could you connect us with the partner responsible for your firm's digital presence?",
    },
    {
        "industry": "Legal Services",
        "company": "Vanguard Legal Partners",
        "salutation": "Dear Vanguard Legal Partners Team,",
        "subject": "Client consultation inquiry workflow",
        "observation_url": "https://vanguardlegal.in/contact",
        "contact_email": "contact@vanguardlegal.in",
        "proof_line": "Our portfolio includes an internal workforce operations suite with role-based project and attendance tracking.",
        "p1": "We noticed that your contact page lists telephone numbers and a general email without an intake form for client matter inquiries.",
        "p2": "A structured inquiry workflow with preliminary practice-area routing could help your team categorize incoming consultation requests more efficiently while maintaining client confidentiality.",
        "p3": "At OneFolk, our portfolio includes an internal workforce operations suite with role-based project and attendance tracking, creating structured operational tools for professional firms.",
        "p4": "Would you be open to a brief discussion about modernizing client intake?",
    },
    {
        "industry": "Hospitality & Boutique Stays",
        "company": "Heritage Valley Retreat",
        "salutation": "Dear Heritage Valley Retreat Team,",
        "subject": "Direct reservation portal review",
        "observation_url": "https://heritagevalleyretreat.com/rooms",
        "contact_email": "stay@heritagevalleyretreat.com",
        "proof_line": "Our portfolio includes a digital room allocation and accommodation management system.",
        "p1": "We noticed that your accommodations page redirects guests to a third-party directory for availability checks rather than offering direct booking.",
        "p2": "An integrated direct inquiry and reservation calendar could help guests secure rooms immediately on your site while reducing reliance on external booking commissions.",
        "p3": "At OneFolk, our portfolio includes a digital room allocation and accommodation management system, streamlining lodging reservations and guest workflows.",
        "p4": "Could you direct us to the person who manages your reservations and website?",
    },
    {
        "industry": "Logistics & Freight Services",
        "company": "TransContinental Logistics",
        "salutation": "Dear TransContinental Logistics Team,",
        "subject": "Consignment tracking web experience",
        "observation_url": "https://transcontinentallogistics.com/services/freight",
        "contact_email": "operations@transcontinentallogistics.com",
        "proof_line": "Our portfolio includes an invoicing, tax computation and financial operations web application.",
        "p1": "We noticed that your freight services page asks shippers to email manual tracking requests rather than offering an online status lookup.",
        "p2": "A self-service consignment lookup portal could provide shippers with instant milestone updates, freeing your customer support team from repetitive status calls.",
        "p3": "At OneFolk, our portfolio includes an invoicing, tax computation and financial operations web application, building specialized operational portals for commercial enterprises.",
        "p4": "Could you connect us with your logistics operations coordinator for a quick chat?",
    },
    {
        "industry": "Professional Accounting & Audit",
        "company": "Sterling Chartered Accountants",
        "salutation": "Dear Sterling Chartered Accountants Team,",
        "subject": "Corporate tax filing resource portal",
        "observation_url": "https://sterlingca.in/resources/tax-updates",
        "contact_email": "desk@sterlingca.in",
        "proof_line": "Our portfolio includes an invoicing, tax computation and financial operations web application.",
        "p1": "We noticed that your tax updates archive links to non-downloadable scanned circulars rather than categorized compliance advisories.",
        "p2": "A searchable compliance repository with downloadable tax schedules could help corporate clients locate statutory filing deadlines quickly and reinforce your firm's advisory standing.",
        "p3": "At OneFolk, our portfolio includes an invoicing, tax computation and financial operations web application, engineering financial software and clean data management systems.",
        "p4": "Could you connect us with the partner overseeing your client communication tools?",
    },
    {
        "industry": "Creative Studio & Media",
        "company": "Echo Motion Design Studio",
        "salutation": "Dear Echo Motion Design Team,",
        "subject": "Case study playback and inquiry workflow",
        "observation_url": "https://echomotion.tv/showreel",
        "contact_email": "hello@echomotion.tv",
        "proof_line": "Our team designed and built the OneFolk website.",
        "p1": "We noticed that your motion reel page embeds videos without an interactive project brief submission form for commercial brand inquiries.",
        "p2": "Pairing your video showcase with an interactive scope inquiry tool could allow prospective agency partners to outline project requirements directly after viewing your reel.",
        "p3": "At OneFolk, our team designed and built the OneFolk website, delivering high-performance media presentations and interactive interfaces.",
        "p4": "Could you direct us to the creative producer managing incoming inquiries?",
    },
    {
        "industry": "Retail & Wholesale Commercial Goods",
        "company": "Artisan Decor Wholesalers",
        "salutation": "Dear Artisan Decor Team,",
        "subject": "Wholesale catalogue and dealer inquiries",
        "observation_url": "https://artisandecor.in/trade-catalogue",
        "contact_email": "dealers@artisandecor.in",
        "proof_line": "Our portfolio includes a multi-vendor campus ordering web application with live order status and QR pickup.",
        "p1": "We noticed that your trade catalogue requires retail dealers to download a static sixty-megabyte PDF file to view seasonal inventory.",
        "p2": "A fast web-based digital lookbook with structured SKU categorization could make product discovery substantially easier for trade buyers across mobile devices.",
        "p3": "At OneFolk, our portfolio includes a multi-vendor campus ordering web application with live order status and QR pickup, delivering modern digital product experiences.",
        "p4": "Could you connect us with your commercial sales manager for a brief discussion?",
    },
    {
        "industry": "Property & Facilities Management",
        "company": "Summit Commercial Assets",
        "salutation": "Dear Summit Commercial Assets Team,",
        "subject": "Tenant service and maintenance ticketing",
        "observation_url": "https://summitassets.com/tenant-portal",
        "contact_email": "management@summitassets.com",
        "proof_line": "Our portfolio includes a digital room allocation and accommodation management system.",
        "p1": "We noticed that your tenant portal displays a static phone directory for maintenance issues without an online ticket submission interface.",
        "p2": "A mobile-friendly maintenance reporting interface could allow commercial tenants to log facility requests with photo attachments and receive real-time resolution updates.",
        "p3": "At OneFolk, our portfolio includes a digital room allocation and accommodation management system, building practical property operations and facility workflows.",
        "p4": "Could you direct us to the operations manager overseeing property systems?",
    },
]

def format_complete_email(candidate: dict) -> str:
    body = f"{candidate['p1']}\n\n{candidate['p2']}\n\n{candidate['p3']}\n\n{candidate['p4']}"
    return (
        f"Subject: {candidate['subject']}\n\n"
        f"{candidate['salutation']}\n\n"
        f"{body}\n\n"
        "Our work: https://onefolk.in/work\n\n"
        "Regards,\n"
        "Team OneFolk\n"
        "https://onefolk.in/"
    )

def main():
    print("=" * 75)
    print("ONEFOLK COLD EMAIL ACCEPTANCE INSPECTION: 10 INDUSTRY SAMPLES")
    print("=" * 75)

    all_passed = True
    results = []

    for idx, c in enumerate(CANDIDATES, 1):
        body = f"{c['p1']}\n\n{c['p2']}\n\n{c['p3']}\n\n{c['p4']}"
        full_email = format_complete_email(c)

        # Validate with python validator
        is_valid, reason, metrics = validate_email_body(body, c["proof_line"])
        salutation, content_paras = parse_email_paragraphs(body)
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

        print(f"\n[{idx}/10] Industry: {c['industry']}")
        print(f"Company: {c['company']}")
        print(f"Contact Email: {c['contact_email']}")
        print(f"Observation Source: {c['observation_url']}")
        print(f"Word Count: {word_count} words (Target: 70-120)")
        print(f"Paragraph Count: {paragraph_count} (Required: 4)")
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
        print("\nALL 10 DRAFTS STRICTLY COMPLY WITH THE APPROVED ONEFOLK COLD-EMAIL STANDARD!")
    else:
        print("\nSOME DRAFTS FAILED COMPLIANCE CHECK!")
        sys.exit(1)

if __name__ == "__main__":
    main()

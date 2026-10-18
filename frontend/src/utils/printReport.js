/**
 * Dedicated Clinical Report Print Engine
 * Isolates the clinical report DOM inside a clean, hidden iframe before invoking print.
 * This guarantees zero bleed from SPA layout, sidebar, navbar, modals, or browser scrollbars,
 * and produces a crisp, high-fidelity A4 document for physical printing and PDF export.
 */

export const printClinicalReport = (elementId = "clinical-report-printable-area") => {
    // 1. Locate the report element (fallback to .clinical-print-document if id not found)
    const sourceEl =
        document.getElementById(elementId) ||
        document.querySelector(".clinical-print-document");

    if (!sourceEl) {
        console.warn("Clinical report element not found, falling back to window.print()");
        window.print();
        return;
    }

    // 2. Clone the HTML of the report
    const reportHtml = sourceEl.outerHTML;

    // 3. Create or reuse an isolated print iframe
    let printIframe = document.getElementById("cardioxai-print-engine-iframe");
    if (printIframe) {
        try {
            printIframe.remove();
        } catch (e) {
            // ignore
        }
    }

    printIframe = document.createElement("iframe");
    printIframe.id = "cardioxai-print-engine-iframe";
    printIframe.style.position = "fixed";
    printIframe.style.right = "0";
    printIframe.style.bottom = "0";
    printIframe.style.width = "0";
    printIframe.style.height = "0";
    printIframe.style.border = "none";
    printIframe.style.visibility = "hidden";
    printIframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(printIframe);

    const frameWindow = printIframe.contentWindow;
    const frameDoc = frameWindow.document;

    frameDoc.open();
    frameDoc.write(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CardioXAI - Cardiovascular Clinical Diagnostic Report</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm 12mm;
        }

        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        html, body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 10.5pt;
            line-height: 1.45;
            -webkit-font-smoothing: antialiased;
        }

        .clinical-print-document {
            background: #ffffff;
            color: #0f172a;
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
        }

        /* Institutional Header */
        .print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 10px;
        }

        .print-header-left {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .print-institution-logo {
            font-size: 34px;
            line-height: 1;
        }

        .print-institution-name {
            margin: 0;
            font-size: 17px;
            font-weight: 800;
            color: #0369a1;
            letter-spacing: -0.2px;
        }

        .print-institution-dept {
            margin: 2px 0 0;
            font-size: 11.5px;
            font-weight: 600;
            color: #334155;
        }

        .print-institution-sub {
            margin: 2px 0 0;
            font-size: 9.5px;
            color: #64748b;
        }

        .print-header-right {
            text-align: right;
            font-size: 10px;
            color: #475569;
        }

        .print-doc-classification {
            display: inline-block;
            padding: 2px 7px;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #0f172a;
            margin-bottom: 4px;
        }

        .print-meta-line {
            margin-bottom: 2px;
        }

        .print-divider {
            height: 2px;
            background: #0284c7;
            margin-bottom: 12px;
        }

        /* Document Title */
        .print-title-section {
            text-align: center;
            margin-bottom: 14px;
            padding: 4px 0;
            border-bottom: 1px solid #e2e8f0;
        }

        .print-title {
            margin: 0;
            font-size: 15px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #0f172a;
        }

        .print-subtitle {
            margin: 2px 0 0;
            font-size: 10.5px;
            color: #64748b;
        }

        /* Report Sections */
        .print-section {
            margin-bottom: 13px;
            page-break-inside: avoid;
        }

        .print-section-header {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.6px;
            color: #0369a1;
            text-transform: uppercase;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 2px;
            margin-bottom: 6px;
        }

        /* Demographics Table */
        .print-demographics-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10.5px;
        }

        .print-demographics-table td {
            padding: 4px 6px;
            border-bottom: 1px solid #f1f5f9;
        }

        .print-demog-label {
            width: 22%;
            color: #64748b;
            font-weight: 600;
        }

        .print-demog-val {
            width: 28%;
            color: #0f172a;
        }

        /* Clinical Risk Assessment Box */
        .print-assessment-box {
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 6px;
            page-break-inside: avoid;
        }

        .print-assessment-box.risk-detected {
            border: 1.5px solid #ef4444;
            background: #fef2f2 !important;
        }

        .print-assessment-box.risk-optimal {
            border: 1.5px solid #16a34a;
            background: #f0fdf4 !important;
        }

        .print-assessment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }

        .print-eval-tag {
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #475569;
            text-transform: uppercase;
            display: block;
        }

        .print-eval-finding {
            margin: 2px 0 0;
            font-size: 13.5px;
            font-weight: 800;
            color: #0f172a;
        }

        .print-eval-badge {
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 9.5px;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #ffffff;
        }

        .badge-risk {
            background: #dc2626 !important;
            color: #ffffff !important;
        }

        .badge-optimal {
            background: #16a34a !important;
            color: #ffffff !important;
        }

        .print-eval-body p {
            margin: 0;
            font-size: 10.5px;
            line-height: 1.45;
            color: #334155;
        }

        /* Biomarker Data Table */
        .print-data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            border: 1px solid #cbd5e1;
            page-break-inside: avoid;
        }

        .print-data-table th {
            background: #f8fafc !important;
            color: #475569;
            font-weight: 700;
            text-align: left;
            padding: 5px 7px;
            border: 1px solid #cbd5e1;
            font-size: 9.5px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        .print-data-table td {
            padding: 4px 7px;
            border: 1px solid #e2e8f0;
            color: #1e293b;
        }

        .print-data-table td strong {
            display: block;
            color: #0f172a;
        }

        .print-data-table td small {
            display: block;
            color: #64748b;
            font-size: 8.5px;
        }

        .text-warn {
            color: #b91c1c !important;
            font-weight: 700;
        }

        .text-ok {
            color: #15803d !important;
            font-weight: 600;
        }

        /* XAI Attribution Grid */
        .print-xai-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            page-break-inside: avoid;
        }

        .print-xai-card {
            background: #f8fafc !important;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 10px;
        }

        .print-xai-title {
            font-size: 10px;
            font-weight: 800;
            margin-bottom: 4px;
            color: #0f172a;
        }

        .print-xai-list {
            margin: 0;
            padding-left: 15px;
            font-size: 9.5px;
            color: #334155;
        }

        .print-xai-list li {
            margin-bottom: 3px;
            line-height: 1.35;
        }

        /* Guidance Grid */
        .print-guidance-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            page-break-inside: avoid;
        }

        .print-guidance-item {
            background: #f8fafc !important;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 8px;
            font-size: 9.5px;
        }

        .print-guidance-item strong {
            display: block;
            color: #0369a1;
            margin-bottom: 2px;
        }

        .print-guidance-item p {
            margin: 0;
            color: #475569;
            line-height: 1.35;
        }

        /* Signature Section */
        .print-signature-section {
            margin-top: 14px;
            padding-top: 6px;
            border-top: 1px solid #cbd5e1;
            page-break-inside: avoid;
        }

        .print-signature-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            gap: 20px;
        }

        .print-signature-box {
            flex: 1;
        }

        .print-sig-line {
            height: 1px;
            background: #94a3b8;
            margin-bottom: 4px;
        }

        .print-sig-role {
            font-size: 9.5px;
            font-weight: 700;
            color: #0f172a;
            display: block;
        }

        .print-signature-box small {
            font-size: 8.5px;
            color: #64748b;
            display: block;
        }

        .print-disclaimer {
            background: #f8fafc !important;
            border-left: 3px solid #0284c7;
            padding: 5px 8px;
            font-size: 8px;
            color: #64748b;
            line-height: 1.35;
        }
    </style>
</head>
<body>
    ${reportHtml}
</body>
</html>
    `);
    frameDoc.close();

    // Trigger printing once the iframe has completed rendering
    setTimeout(() => {
        try {
            frameWindow.focus();
            frameWindow.print();
        } catch (err) {
            console.error("Frame print failed, invoking fallback:", err);
            window.print();
        }
    }, 250);
};


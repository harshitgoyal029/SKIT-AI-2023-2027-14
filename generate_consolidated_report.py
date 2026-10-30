
import os
import re
import subprocess
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table,
    TableStyle, Image, PageBreak, LongTable
)

# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

OUTPUT_DIR = Path("consolidated_reports")
OUTPUT_DIR.mkdir(exist_ok=True)

REPO_NAME = os.getenv(
    "GITHUB_REPOSITORY",
    Path.cwd().name
)

OUTPUT_FILE = OUTPUT_DIR / "Complete_Project_Progress_Report.pdf"

# --------------------------------------------------
# FETCH COMPLETE GIT HISTORY
# --------------------------------------------------

def get_git_history():

    command = [
        "git", "log",
        "--all",
        "--no-merges",
        "--date=short",
        "--format=%H%x1f%an%x1f%ae%x1f%ad%x1f%s",
        "--numstat"
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=True,
        errors="replace"
    )

    commits = []
    current = None

    for line in result.stdout.splitlines():

        if "\x1f" in line:

            if current:
                commits.append(current)

            parts = line.split("\x1f", 4)

            current = {
                "hash": parts[0],
                "author": parts[1],
                "email": parts[2],
                "date": parts[3],
                "message": parts[4],
                "additions": 0,
                "deletions": 0,
                "files": set()
            }

        elif current and line.strip():

            parts = line.split("\t", 2)

            if len(parts) == 3:

                added, deleted, filename = parts

                if added.isdigit():
                    current["additions"] += int(added)

                if deleted.isdigit():
                    current["deletions"] += int(deleted)

                current["files"].add(filename)

    if current:
        commits.append(current)

    return commits


# --------------------------------------------------
# ANALYZE CONTRIBUTORS
# --------------------------------------------------

def analyze_commits(commits):

    contributors = defaultdict(lambda: {
        "name": "",
        "email": "",
        "commits": [],
        "additions": 0,
        "deletions": 0,
        "files": set(),
        "weeks": defaultdict(int)
    })

    weekly_activity = defaultdict(lambda: defaultdict(int))

    for commit in commits:

        # Email is used to avoid merging different
        # contributors who happen to share a name.
        key = commit["email"].lower() or commit["author"].lower()

        person = contributors[key]

        person["name"] = commit["author"]
        person["email"] = commit["email"]
        person["commits"].append(commit)

        person["additions"] += commit["additions"]
        person["deletions"] += commit["deletions"]
        person["files"].update(commit["files"])

        date = datetime.strptime(commit["date"], "%Y-%m-%d")
        week = date.strftime("%G-W%V")

        person["weeks"][week] += 1
        weekly_activity[week][key] += 1

    return contributors, weekly_activity


# --------------------------------------------------
# GENERATE CHARTS
# --------------------------------------------------

def generate_charts(contributors, weekly_activity):

    chart_dir = OUTPUT_DIR / "charts"
    chart_dir.mkdir(exist_ok=True)

    # 1. Individual commit comparison

    names = [
        p["name"] for p in contributors.values()
    ]

    counts = [
        len(p["commits"]) for p in contributors.values()
    ]

    plt.figure(figsize=(10, 5))
    plt.bar(names, counts)
    plt.title("Total Commits by Individual")
    plt.xlabel("Contributors")
    plt.ylabel("Number of Commits")
    plt.xticks(rotation=30, ha="right")
    plt.tight_layout()

    commit_chart = chart_dir / "individual_commits.png"
    plt.savefig(commit_chart, dpi=180)
    plt.close()

    # 2. Weekly contribution trend

    weeks = sorted(weekly_activity.keys())

    plt.figure(figsize=(12, 6))

    # Display up to the six most active contributors
    top_people = sorted(
        contributors.items(),
        key=lambda x: len(x[1]["commits"]),
        reverse=True
    )[:6]

    for key, person in top_people:

        values = [
            weekly_activity[w].get(key, 0)
            for w in weeks
        ]

        plt.plot(
            weeks,
            values,
            marker="o",
            label=person["name"]
        )

    plt.title("Weekly Commit Activity by Contributor")
    plt.xlabel("Week")
    plt.ylabel("Commits")
    plt.xticks(rotation=45)
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()

    weekly_chart = chart_dir / "weekly_activity.png"
    plt.savefig(weekly_chart, dpi=180)
    plt.close()

    # 3. Code additions and deletions

    plt.figure(figsize=(10, 5))

    additions = [
        p["additions"] for p in contributors.values()
    ]

    deletions = [
        p["deletions"] for p in contributors.values()
    ]

    x = range(len(names))
    width = 0.35

    plt.bar(
        [i - width / 2 for i in x],
        additions,
        width,
        label="Lines Added"
    )

    plt.bar(
        [i + width / 2 for i in x],
        deletions,
        width,
        label="Lines Deleted"
    )

    plt.xticks(list(x), names, rotation=30, ha="right")
    plt.title("Code Changes by Individual")
    plt.ylabel("Lines")
    plt.legend()
    plt.tight_layout()

    changes_chart = chart_dir / "code_changes.png"
    plt.savefig(changes_chart, dpi=180)
    plt.close()

    return commit_chart, weekly_chart, changes_chart


# --------------------------------------------------
# PDF FORMATTING
# --------------------------------------------------

def generate_pdf(commits, contributors, weekly_activity, charts):

    doc = SimpleDocTemplate(
        str(OUTPUT_FILE),
        pagesize=A4,
        rightMargin=35,
        leftMargin=35,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="MainTitle",
        parent=styles["Title"],
        fontSize=23,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#17365D"),
        spaceAfter=15
    ))

    styles.add(ParagraphStyle(
        name="Section",
        parent=styles["Heading1"],
        textColor=colors.HexColor("#17365D"),
        spaceBefore=15,
        spaceAfter=10
    ))

    styles.add(ParagraphStyle(
        name="SmallCell",
        parent=styles["BodyText"],
        fontSize=7,
        leading=9,
        wordWrap="CJK"
    ))

    story = []

    total_commits = len(commits)
    total_additions = sum(c["additions"] for c in commits)
    total_deletions = sum(c["deletions"] for c in commits)

    all_files = set()
    for commit in commits:
        all_files.update(commit["files"])

    # COVER PAGE

    story.append(Spacer(1, 1.0 * inch))

    story.append(Paragraph(
        "COMPLETE PROJECT<br/>PROGRESS REPORT",
        styles["MainTitle"]
    ))

    story.append(Paragraph(
        REPO_NAME,
        styles["Heading2"]
    ))

    story.append(Spacer(1, 0.3 * inch))

    story.append(Paragraph(
        f"Generated on: {datetime.now().strftime('%d %B %Y')}",
        styles["Normal"]
    ))

    story.append(Paragraph(
        f"Reporting period: {commits[-1]['date']} to {commits[0]['date']}",
        styles["Normal"]
    ))

    story.append(PageBreak())

    # OVERALL SUMMARY

    story.append(Paragraph(
        "1. Overall Project Statistics",
        styles["Section"]
    ))

    summary = [
        ["Metric", "Value"],
        ["Total Contributors", len(contributors)],
        ["Total Commits", total_commits],
        ["Total Files Changed", len(all_files)],
        ["Total Lines Added", total_additions],
        ["Total Lines Deleted", total_deletions],
        ["Active Weeks", len(weekly_activity)]
    ]

    table = Table(summary, colWidths=[250, 180])

    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17365D")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold")
    ]))

    story.append(table)

    # CHARTS

    story.append(Paragraph(
        "2. Contribution Analytics",
        styles["Section"]
    ))

    for chart in charts:

        story.append(Image(
            str(chart),
            width=6.7 * inch,
            height=3.3 * inch
        ))

        story.append(Spacer(1, 10))

    # INDIVIDUAL CONTRIBUTIONS

    story.append(PageBreak())

    story.append(Paragraph(
        "3. Individual Contribution Analysis",
        styles["Section"]
    ))

    for key, person in sorted(
        contributors.items(),
        key=lambda x: len(x[1]["commits"]),
        reverse=True
    ):

        story.append(Paragraph(
            person["name"],
            styles["Heading2"]
        ))

        story.append(Paragraph(
            f"Email: {person['email']}",
            styles["Normal"]
        ))

        details = [
            ["Metric", "Value"],
            ["Total Commits", len(person["commits"])],
            ["Active Weeks", len(person["weeks"])],
            ["Files Modified", len(person["files"])],
            ["Lines Added", person["additions"]],
            ["Lines Deleted", person["deletions"]]
        ]

        t = Table(details, colWidths=[220, 180])

        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D9EAF7")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("PADDING", (0, 0), (-1, -1), 6)
        ]))

        story.append(t)
        story.append(Spacer(1, 12))

        # Individual commit history

        commit_data = [
            ["Date", "Commit Hash", "Commit Message"]
        ]

        for c in sorted(
            person["commits"],
            key=lambda x: x["date"]
        ):

            commit_data.append([
                c["date"],
                c["hash"][:8],
                Paragraph(
                    c["message"][:250],
                    styles["SmallCell"]
                )
            ])

        ct = LongTable(
            commit_data,
            colWidths=[75, 75, 270],
            repeatRows=1
        )

        ct.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17365D")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("PADDING", (0, 0), (-1, -1), 5)
        ]))

        story.append(ct)
        story.append(Spacer(1, 20))

    # WEEKLY ACTIVITY

    story.append(PageBreak())

    story.append(Paragraph(
        "4. Week-wise Contribution Summary",
        styles["Section"]
    ))

    weekly_data = [["Week", "Contributor", "Commits"]]

    for week in sorted(weekly_activity):

        for key, count in sorted(
            weekly_activity[week].items(),
            key=lambda x: x[1],
            reverse=True
        ):

            weekly_data.append([
                week,
                contributors[key]["name"],
                count
            ])

    wt = LongTable(
        weekly_data,
        colWidths=[110, 240, 70],
        repeatRows=1
    )

    wt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#17365D")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 6)
    ]))

    story.append(wt)

    # COMPLETE FILE CHANGE SUMMARY

    story.append(PageBreak())

    story.append(Paragraph(
        "5. Files Modified",
        styles["Section"]
    ))

    for key, person in contributors.items():

        story.append(Paragraph(
            f"<b>{person['name']}</b>",
            styles["Normal"]
        ))

        for filename in sorted(person["files"]):

            story.append(Paragraph(
                f"• {filename}",
                styles["SmallCell"]
            ))

        story.append(Spacer(1, 8))

    # FOOTER

    def add_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(
            560, 20,
            f"Page {doc.page}"
        )
        canvas.restoreState()

    doc.build(
        story,
        onFirstPage=add_page_number,
        onLaterPages=add_page_number
    )

    print(f"Report generated: {OUTPUT_FILE}")


# --------------------------------------------------
# MAIN
# --------------------------------------------------

def main():

    print("Fetching complete Git history...")

    commits = get_git_history()

    if not commits:
        raise RuntimeError("No commits found in repository.")

    print(f"Total commits found: {len(commits)}")

    contributors, weekly_activity = analyze_commits(commits)

    print(f"Total contributors: {len(contributors)}")

    charts = generate_charts(
        contributors,
        weekly_activity
    )

    generate_pdf(
        commits,
        contributors,
        weekly_activity,
        charts
    )


if __name__ == "__main__":
    main()

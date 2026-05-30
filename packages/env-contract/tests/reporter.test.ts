import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatJsonCheck, formatJsonSync, formatJsonScan } from "../src/reporters/json.js";
import { reportSync, reportScan, reportCheck } from "../src/reporters/pretty.js";
import type { SyncReport, ScanReportData, CheckReport } from "../src/reporters/types.js";

describe("JSON Reporter", () => {
  it("should format check reports in workspace mode", () => {
    const report: CheckReport = {
      ok: false,
      workspace: true,
      packages: [
        {
          package: "/path/to/pkg-a",
          syncDrift: true,
          exampleDrift: {
            missingInExample: ["PORT"],
            extraInExample: ["TEMP"],
          },
          orphanedRefs: [
            { key: "DB_URL", file: "index.ts", line: 10, column: 5, kind: "process.env" },
          ],
          unusedSchemaKeys: [],
          dynamicRefs: [],
          warnings: [],
        },
      ],
    };

    const formatted = formatJsonCheck(report);
    const parsed = JSON.parse(formatted);
    expect(parsed).toBeInstanceOf(Array);
    expect(parsed[0].package).toBe("/path/to/pkg-a");
    expect(parsed[0].syncDrift).toBe(true);
    expect(parsed[0].exampleDrift.missingInExample).toContain("PORT");
    expect(parsed[0].orphanedRefs[0].key).toBe("DB_URL");
  });

  it("should format check reports in single-package mode", () => {
    const report: CheckReport = {
      ok: true,
      workspace: false,
      packages: [
        {
          package: "/path/to/pkg-b",
          syncDrift: false,
          exampleDrift: {
            missingInExample: [],
            extraInExample: [],
          },
          orphanedRefs: [],
          unusedSchemaKeys: [],
          dynamicRefs: [],
          warnings: [],
        },
      ],
    };

    const formatted = formatJsonCheck(report);
    const parsed = JSON.parse(formatted);
    expect(parsed).not.toBeInstanceOf(Array);
    expect(parsed.syncDrift).toBe(false);
    expect(parsed.exampleDrift.missingInExample).toHaveLength(0);
  });

  it("should format sync reports for single and multiple packages", () => {
    const singleReport: SyncReport = {
      exampleFile: ".env.example",
      syncDrift: true,
      missingInExample: ["PORT"],
      extraInExample: [],
      ignoredKeys: [],
    };

    const formattedSingle = formatJsonSync(singleReport);
    expect(JSON.parse(formattedSingle).syncDrift).toBe(true);

    const multiReports: SyncReport[] = [
      {
        package: "pkg-a",
        exampleFile: "pkg-a/.env.example",
        syncDrift: true,
        missingInExample: ["PORT"],
        extraInExample: [],
        ignoredKeys: [],
      },
    ];
    const formattedMulti = formatJsonSync(multiReports);
    const parsedMulti = JSON.parse(formattedMulti);
    expect(parsedMulti).toBeInstanceOf(Array);
    expect(parsedMulti[0].package).toBe("pkg-a");
  });

  it("should format scan reports for single and multiple packages", () => {
    const singleReport: ScanReportData = {
      rootDir: "src",
      orphanedRefs: [],
      unusedSchemaKeys: [],
      dynamicRefs: [],
      warnings: [],
    };

    const formattedSingle = formatJsonScan(singleReport);
    expect(JSON.parse(formattedSingle).orphanedRefs).toHaveLength(0);

    const multiReports: ScanReportData[] = [
      {
        package: "pkg-a",
        rootDir: "pkg-a/src",
        orphanedRefs: [],
        unusedSchemaKeys: [],
        dynamicRefs: [],
        warnings: [],
      },
    ];
    const formattedMulti = formatJsonScan(multiReports);
    const parsedMulti = JSON.parse(formattedMulti);
    expect(parsedMulti).toBeInstanceOf(Array);
    expect(parsedMulti[0].package).toBe("pkg-a");
  });
});

describe("Pretty Reporter", () => {
  let logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  let errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("reportSync", () => {
    it("should log up to date message if there is no drift", () => {
      const report: SyncReport = {
        exampleFile: ".env.example",
        syncDrift: false,
        missingInExample: [],
        extraInExample: [],
        ignoredKeys: [],
      };

      reportSync(report, { check: false });
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls.flat().join(" ");
      expect(output).toContain(".env.example is already up to date");
    });

    it("should log success message on successful sync write", () => {
      const report: SyncReport = {
        exampleFile: ".env.example",
        syncDrift: true,
        missingInExample: ["PORT"],
        extraInExample: [],
        ignoredKeys: [],
      };

      reportSync(report, { check: false });
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls.flat().join(" ");
      expect(output).toContain("Successfully updated .env.example");
    });

    it("should log drift details when in check mode", () => {
      const report: SyncReport = {
        exampleFile: ".env.example",
        syncDrift: true,
        missingInExample: ["PORT"],
        extraInExample: ["BAD_KEY"],
        ignoredKeys: [],
      };

      reportSync(report, { check: true });
      expect(errorSpy).toHaveBeenCalled();
      const output = errorSpy.mock.calls.flat().join(" ");
      expect(output).toContain("Drift detected in .env.example");
      expect(output).toContain("PORT");
      expect(output).toContain("BAD_KEY");
    });

    it("should display package markers in workspace mode", () => {
      const reports: SyncReport[] = [
        {
          package: "packages/pkg-a",
          exampleFile: "packages/pkg-a/.env.example",
          syncDrift: false,
          missingInExample: [],
          extraInExample: [],
          ignoredKeys: [],
        },
        {
          package: "packages/pkg-b",
          exampleFile: "packages/pkg-b/.env.example",
          syncDrift: false,
          missingInExample: [],
          extraInExample: [],
          ignoredKeys: [],
        },
      ];

      reportSync(reports, { check: false });
      const output = logSpy.mock.calls.flat().join(" ");
      expect(output).toContain("packages/pkg-a");
      expect(output).toContain("packages/pkg-b");
    });
  });

  describe("reportScan", () => {
    it("should print clean scan status when no contract violations", () => {
      const report: ScanReportData = {
        rootDir: "src",
        orphanedRefs: [],
        unusedSchemaKeys: [],
        dynamicRefs: [],
        warnings: [],
      };

      reportScan(report, { strict: false });
      const output = logSpy.mock.calls.flat().join(" ");
      expect(output).toContain("No environment contract violations found");
    });

    it("should report warnings, orphaned refs, dynamic accesses and unused schema keys", () => {
      const report: ScanReportData = {
        package: "pkg-a",
        rootDir: "src",
        orphanedRefs: [
          { key: "DB_PASS", file: "src/db.ts", line: 12, column: 4, kind: "process.env" },
        ],
        unusedSchemaKeys: ["UNUSED_KEY"],
        dynamicRefs: [
          { file: "src/index.ts", line: 5, snippet: "Object.keys(process.env)" },
        ],
        warnings: [
          { file: "src/bad.ts", message: "Parsing failed" },
        ],
      };

      reportScan(report, { strict: true });
      const output = logSpy.mock.calls.flat().join(" ");
      expect(output).toContain("pkg-a");
      expect(output).toContain("Parsing failed");
      expect(output).toContain("DB_PASS");
      expect(output).toContain("Object.keys(process.env)");
      expect(output).toContain("UNUSED_KEY");
    });
  });

  describe("reportCheck", () => {
    it("should print healthy status when ok", () => {
      const report: CheckReport = {
        ok: true,
        workspace: false,
        packages: [
          {
            package: "pkg-a",
            syncDrift: false,
            exampleDrift: { missingInExample: [], extraInExample: [] },
            orphanedRefs: [],
            unusedSchemaKeys: [],
            dynamicRefs: [],
            warnings: [],
          },
        ],
      };

      reportCheck(report, { strict: false });
      const output = logSpy.mock.calls.flat().join(" ");
      expect(output).toContain("Environment contract is healthy");
    });

    it("should report sync drift and orphaned refs", () => {
      const report: CheckReport = {
        ok: false,
        workspace: false,
        packages: [
          {
            package: "pkg-a",
            syncDrift: true,
            exampleDrift: { missingInExample: ["PORT"], extraInExample: [] },
            orphanedRefs: [
              { key: "ORPHAN", file: "src/index.ts", line: 2, column: 10, kind: "process.env" },
            ],
            unusedSchemaKeys: [],
            dynamicRefs: [],
            warnings: [],
          },
        ],
      };

      reportCheck(report, { strict: false });
      const output = errorSpy.mock.calls.flat().join(" ");
      expect(output).toContain(".env.example is out of date");
      expect(output).toContain("ORPHAN");
    });
  });
});

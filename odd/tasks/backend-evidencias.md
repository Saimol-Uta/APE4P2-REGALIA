# Backend APE4: execution and evidence
Branch: test/ape4-backend-evidencias
Status: backend evidence complete; no commits or pushes

## Specs
S1. "tambien realiza el apartado que me toco ami"
S2. "colocando sus correspondientes imagenes"
S3. "si ha estado sus parte, puedes revisar y decirme si todo lo que esta hay es correcto y no inventado?"
S4. "mante el titulo que si esta bien pero quita el apartado que dice representacion del resumen y tambien quita el log completo"
S5. "si aprovado"

## Tasks
- T1 [S1, S2, S5] worker: Execute isolated updated CP-023 and CP-027 rules while preserving old evidence; done, 15/15 suite passed and independently reviewed; uncommitted.
- T2 [S1, S2, S5] inline: Populate all backend records and evidence; done, 27 PASS, prior FAILs retained, PDF checked; uncommitted.
- T3 [S3] inline: Report audit findings and evidentiary limitations; done as a sampled review, not a full verification; no commit.

## Log
L1. "si ha estado sus parte, puedes revisar y decirme si todo lo que esta hay es correcto y no inventado?"
L2. "mientras revisas , tambien realiza el apartado que me toco ami"
L3. "colocando sus correspondientes imagenes"
L4. E2E isolated run exited 0: 48 suites passed, one skipped; 771 tests passed, two skipped. Newman isolated run exited 0: 111 requests and 466 assertions, no failures. Coverage first run exited 134 due to Node heap exhaustion; rerun with 4096 MB exited 0 with 112 suites and 1429 tests passed. Existing tests do not necessarily cover each complete case.
L5. Exact case-level test preparation is tracked in the backend repository at odd/tasks/ape4-backend-proof.md; no production implementation changes authorized. Case proofs use isolated databases.
L6. CP-001..CP-012 focused suite exited 0 with 12 passed. CP-013..CP-027 produced 8 passed and 7 setup failures (Postgres client is closed), then Jest did not exit; the user approved stopping the hung job. The worker's one bounded correction run was canceled during a server restart and has no final result or exit code. These setup failures are not established product defects; the routing proof remains incomplete.
L7. Independent verifier reviewed all commercial case assertions against the design and successful suite log. CP-001..CP-012 recorded PASS with 12 images rendered from the shared Jest summary; raw log and source copy retained under evidencias/logs/. PDF compiled successfully (81 pages). The report's existing general statements that all 107 cases were executed remain misleading while CP-013..CP-027 are empty; do not present this PDF as final.
L8. "si tienes autorizacion pero antes has este cambio en la imagen que se usan , mante el titulo que si esta bien pero quita el apartado que dice representacion del resumen y tambien quita el log completo, has esto cambios en la imagen , esto porque al ing solo se le va a proporcionar el pdf no un zip"
L9. Removed the two requested text lines from all 12 generated images and rebuilt PDF (81 pages). The report text still identifies images as renderings of the combined Jest summary. User authorized the proposed bounded continuation for CP-013..CP-027.
L10. Bounded focused routing run exited 1 after 34 seconds: 14 passed, CP-023 failed because the null-date order was absent from excluded. Assertions after that failure did not execute in CP-023. The Jest process exited and no matching temporary containers remained in the inspected list. Per the agreed stop, no further test or correction was attempted. Remaining case outcomes have not been independently verified or entered in the PDF.
L11. "si revisa , si no se cumple pon en el documento como defecto y que no pasa"
L12. Read authorized NR-10 and NP-15 source: both require identification for scheduling and no automatic assignment, neither specifies the excluded list. Recorded CP-023 FAIL against its own stated expected result and DEF-08 as an unresolved specification/implementation discrepancy, not a confirmed product defect; severity pending. Embedded a rendering of the actual failure excerpt and rebuilt the PDF (82 pages). Corrected report-wide claims of completed execution to identify the report as partial.
L13. "completa los faltantes"
L14. Independent verifier compared the 14 passing tests with case criteria and actual combined log. CP-021 and CP-027 have partial proof: simulated road engine / boundary coverage and rescheduling before today's eligibility respectively. CP-025 is supported by the separate earlier successful recovery suite as well as the focused suite.
L15. All 27 backend fichas now have status and image: 24 PASS, CP-023 FAIL (DEF-08), CP-021 and CP-027 BLOCKED. All generated images disclose aggregate results via report text; road engine simulation stated explicitly. PDF compiled successfully at 86 pages; structural check verified counts and all 27 image files. CP-023 failure and missing proof remain unresolved.
L16. "si continua para resolver eso"
L17. User authorized continuation of the missing CP-021 and CP-027 proof without modifying production logic. Investigating local OSRM real prerequisites and exact dated-order fixture; do not use production data.
L18. "hay uno en el servidor de mi casa local puede usarlo , busca en la memoria informacion"
L19. User supplied OSRM container network address. Accessed via a temporary SSH tunnel bound to loopback; an isolated backend suite against real OSRM passed 2/2 (exit 0), with owned temporary PostgreSQL. Tunnel closed afterwards. Existing passing shop-settings E2E test verifies margins 5 and 180.
L20. Focused CP-027 test without post-release date mutation ran the full 15-case suite due to the enclosing describe matching the name filter; exit 1: 13 passed, CP-023 and CP-027 failed. CP-027 confirmed release, audit and replay, but order dated yesterday did not appear in today's proposals. DEF-09 records this disputed expectation, not a confirmed product bug.
L21. CP-021 recorded PASS with real OSRM test and separately disclosed simulated tie-break; CP-027 recorded FAIL with observed failure image. Independent verifier found the report consistent with evidence. PDF compiled (86 pages); 27 states verified (25 PASS, 2 FAIL). CP-023 and CP-027 require specification clarification before final closure.
L22. "si aprovado" — approved the immediately preceding proposed revised CP-023 and CP-027 rules, preservation of previous failures, updated fichas, and new isolated execution. Close DEF-08 and DEF-09 only if observed proof supports doing so.
L23. Revised case suite exited 0: 15/15 passed in isolated PostgreSQL and simulated road engine. CP-023 checks paginated admin list, null date, absence from proposals, both HTTP 409s and no new route or claim. CP-027 checks release without changing date, replay audit and subsequent HTTP CONTACT/RESCHEDULE before proposal for a future day. Independent verifier confirmed both case assertions and log, with aggregate rather than individual test output.
L24. Catalog and design updated per approved rules; original FAILs retained in case images, execution text, defect history and original logs. DEF-08 and DEF-09 closed as clarified test expectations, not product fixes. PDF compiled (86 pages); 27/27 backend PASS and all 27 images structurally verified. Team-wide audit remains sampled and consolidated report still has unfinished general summary. No commits or pushes.

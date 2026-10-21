import { expect, it, vi } from "vitest";
import { BackendError, normaliseBackendError } from "../src/backend/errors";
import { publicEnvironment } from "../build/public-env";
import { authFeedback } from "../src/frontend/authFeedback";
it("uses safe auth recovery copy without reflecting provider details",()=>{
  expect(authFeedback({code:"otp_expired",message:"private details"})).toContain("Request a new code");
  expect(authFeedback({message:"SQL and secret content"})).not.toMatch(/SQL|secret/);
});
it("does not disclose SQL, user text or credentials in messages or console diagnostics",()=>{
  const log=vi.spyOn(console,"warn").mockImplementation(()=>{});
  const raw={code:"23505",message:"private@example.com secret=abc table_private",details:"sensitive"};
  const result=normaliseBackendError(raw,"Could not save. Retry.");
  expect(result.message).toBe("Could not save. Retry.");
  expect(result.cause).toBe(raw);
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|secret|sensitive/);
  log.mockRestore();
});
it("offers appropriate recovery for expired sessions and connection failures",()=>{
  expect(normaliseBackendError({status:401},"Failed").message).toContain("Sign in again");
  expect(normaliseBackendError(new TypeError("Failed to fetch"),"Failed").code).toBe("NETWORK");
  const validation=new BackendError("VALIDATION","Choose a date.");
  expect(normaliseBackendError(validation,"Failed")).toBe(validation);
});
it("defines identical web/mobile public values without exposing privileged keys",()=>{
  const definitions=publicEnvironment({NEXT_PUBLIC_CARTO_BASEMAP_API_KEY:"public-map-key",SUPABASE_SERVICE_ROLE_KEY:"private"});
  expect(definitions["process.env.NEXT_PUBLIC_CARTO_BASEMAP_API_KEY"]).toBe('"public-map-key"');
  expect(JSON.stringify(definitions)).not.toContain("private");
});
it("does not claim a write was lost when its network response is uncertain",()=>{
  const error=normaliseBackendError(new TypeError("Failed to fetch"),"Save failed.");
  expect(error.message).toContain("Could not confirm the request");
  expect(error.message).not.toContain("have not been saved");
});

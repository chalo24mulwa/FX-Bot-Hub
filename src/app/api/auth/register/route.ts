import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { signUpSchema } from "@/lib/validations/auth";
import { registerUser } from "@/server/services/auth-service";

export async function POST(request: NextRequest) {
  try {
    const body = signUpSchema.parse(await request.json());
    const user = await registerUser(body);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

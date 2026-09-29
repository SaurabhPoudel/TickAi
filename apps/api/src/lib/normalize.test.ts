import { test } from "node:test";
import assert from "node:assert/strict";
import { pantryKey } from "./normalize.js";

test("pantry keys merge variants", () => {
  assert.equal(pantryKey("Eggs"), "egg");
  assert.equal(pantryKey("a bag of Tomatoes"), "tomato");
  assert.equal(pantryKey("Berries"), "berry");
  assert.equal(pantryKey("Milk"), "milk");
  assert.equal(pantryKey("glass"), "glass");
});

import { assertEquals } from "jsr:@std/assert@1";
import { classifyLocalCommand } from "./routing.ts";

Deno.test("list all recipes is a list, not contextual show", () => {
  for (const input of ["Покажи все рецепты", "покажи всё рецепты", "Выведи все рецепты", "список рецептов", "/list"]) {
    assertEquals(classifyLocalCommand(input), "list");
  }
});

Deno.test("single recipe display is not list", () => {
  for (const input of ["Покажи рецепт", "Покажи 2", "Подробнее", "Найди сырники"]) {
    assertEquals(classifyLocalCommand(input), "other");
  }
});

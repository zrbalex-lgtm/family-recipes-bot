import { assertEquals } from "jsr:@std/assert@1";
import { classifyLocalCommand, parseDraftCallback, explicitRecipeTitle } from "./routing.ts";

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

Deno.test("callback parser accepts only bound draft actions",()=>{
  const id='123e4567-e89b-12d3-a456-426614174000';
  assertEquals(parseDraftCallback('draft:cancel:'+id),{action:'cancel',draftId:id});
  assertEquals(parseDraftCallback('draft:save:'+id),{action:'save',draftId:id});
  for(const bad of ['draft:save:1','draft:delete:../etc/passwd','draft:edit:'+id,'draft:save:'+id+':extra',null,{}]){
    assertEquals(parseDraftCallback(bad),null);
  }
});

Deno.test("explicit recipe name wins over last opened recipe",()=>{
  assertEquals(explicitRecipeTitle('Покажи рецепт Пани Валевская'),'Пани Валевская');
  assertEquals(explicitRecipeTitle('покажи рецепт пани валевская'),'пани валевская');
  assertEquals(explicitRecipeTitle('Покажи рецепт'),null);
  assertEquals(explicitRecipeTitle('Покажи все рецепты'),null);
});

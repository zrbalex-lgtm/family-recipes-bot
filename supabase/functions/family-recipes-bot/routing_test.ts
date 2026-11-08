import { assertEquals } from "jsr:@std/assert@1";
import { classifyLocalCommand, listPage, localRecipeSearch, parseDraftCallback, explicitRecipeTitle, suggestRecipeTitles } from "./routing.ts";

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

Deno.test("typo suggestions are explicit and conservative",()=>{
  const titles=['Пани Валевская','Сырники','Борщ'];
  assertEquals(suggestRecipeTitles('пани валемская',titles),['Пани Валевская']);
  assertEquals(suggestRecipeTitles('пани валевская',titles),[]);
  assertEquals(suggestRecipeTitles('абсолютно другое блюдо',titles),[]);
});

Deno.test("recipe list command word-order variants",()=>{
  for(const input of ['Покажи рецепты все','Покажи все рецепты','Список рецептов','Какие рецепты есть','Какие рецепты у нас есть','Перечень рецептов'])assertEquals(classifyLocalCommand(input),'list');
  for(const input of ['Покажи рецепт Пани','Покажи рецепты с сыром'])assertEquals(classifyLocalCommand(input),'other');
});

Deno.test("numbered recipe list pages",()=>{
  assertEquals(classifyLocalCommand("Список рецептов страница 2"),"list");
  assertEquals(classifyLocalCommand("/list 3"),"list");
  assertEquals(listPage("Список рецептов страница 2"),2);
  assertEquals(listPage("/list 3"),3);
  assertEquals(listPage("Покажи все рецепты"),1);
});

Deno.test("explicit ingredient and tag searches bypass previous results",()=>{
  assertEquals(localRecipeSearch("Покажи рецепты с сыром"),"сыр");
  assertEquals(localRecipeSearch("Покажи рецепты на завтрак"),"завтрак");
  assertEquals(localRecipeSearch("Найди рецепты с сыром"),"сыр");
  assertEquals(localRecipeSearch("Покажи рецепт Пани"),null);
});

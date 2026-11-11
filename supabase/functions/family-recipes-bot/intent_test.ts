import {assertEquals} from "jsr:@std/assert@1";
import {parseRecipeIntent} from "../_shared/recipe-ai.ts";
Deno.test("AI intent parsing fails safely",()=>{
  assertEquals(parseRecipeIntent({intent:"delete",query:""}),{intent:"question",query:""});
  assertEquals(parseRecipeIntent({intent:"edit",query:"  "}),{intent:"question",query:""});
  assertEquals(parseRecipeIntent({intent:"list",query:"сыр"}),{intent:"list",query:""});
  assertEquals(parseRecipeIntent({intent:"search",query:" сыр "}),{intent:"search",query:"сыр"});
  assertEquals(parseRecipeIntent({intent:"unsupported",query:""}),{intent:"question",query:""});
  assertEquals(parseRecipeIntent(null),{intent:"question",query:""});
});
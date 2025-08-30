/api/v1/catalog/products
when adding product we need to titleize the input 
get rid of edition on the catalogProdcutGames i would just make that special edition a new product


make the get variants


make some changes to the variant buckets so that games with the auto link go to the new CIB/complete bucket

i think we can go all in on ignoring the sequence part in the sku and just assign the sku as {po}{id} and then we add a folder order to the 
inventory items that way we don't have to worry about all the extra stuff that comes from skus

give some better errors back almost everything is spitting out a 500 for some reason

when receiving we should add a few different receving modes like scan receiving by upc/name match

need to fix the variant buckets for video games and consoles so they pick CIB instead of original packaging
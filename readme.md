# mini-idb

This is a tiny  library that mostly mirrors the IndexedDB API.Most of what is available and I think is important is kept in place to simplify native operations and to be promise-oriented.

## 1. Installation

``` npm i mini-idb```

## 2. ES6模块系统下的使用（使用前请先了解原生IndexedDB）

导入IndexDB类

```
import {IndexDB} from 'mini-idb';
```

创建一个IndexDB实例

```
const db = new IndexDB('mydatabase', [
	{
		name: 'task',
		key: 'id'
	},
	{
		name: 'tag',
		key: 'id'
	}
]);
```

上面的操作创建了一个名为 `mydatabase` 的本地数据库。同时创建了两张表 `task` 和 `tag`。

也可以在创建的同时给表创建索引。

```
const db = new IndexDB('mydatabase', [
	{
		name: 'task',
		key: 'id',
		indexList: [
            {
                indexName: 'nameIndex',// 索引表名
                keyPath: 'id',// 索引
                objectParameters: {unique: false}// 索引是否唯一
            }
        ]
	},
	{
		name: 'tag',
		key: 'id'
	}
]);
```

创建完成后，建议将该db对象缓存，使用vuex的小伙伴可以将它存入vuex

```
this.$store.commit('saveDatabase', db);
```

## 3. 在Vue项目下使用插件方法安装

允许使用Vue插件方法导入，这样的话可以全局使用

在Vue项目的入口文件中（一般是main.js）

```
import {IndexDBVuePlugin} from 'mini-idb';
Vue.use(IndexDBVuePlugin);
```

这样在Vue实例下添加了IndexDB构造方法，组件使用时需要加 `this`

```
const db = new this.IndexDB('mydatabase', [
	{
		name: 'task',
		key: 'id'
	},
	{
		name: 'tag',
		key: 'id'
	}
]);
```

## 4. template & API

API使用模板，由于IndexedDB存在大量的异步操作，所以推荐使用promise或者async。

```
async template(db) {
	await db.open();
	...这里写业务
	db.close();// 关闭数据库并不是必要的，但是建议手动关闭
}
```
#### Basic API

- `db.open()`
- 打开数据库连接
- `db.close()`
- 关闭数据库连接
- `db.set(storeName, value)`
- 往指定表内插入单个值
- `db.setBatch(storeName, list)`
   - 往指定表内批量插入值
- `db.update(storeName, newValue)`
   - 更新指定表的某个值
- `db.get(storeName, key)`
   - 读取指定表的某个值
- `db.getAll(storeName)`
   - 读取指定表的所有值
- `db.getAllKeys(storeName)`
   - 读取指定表的所有值的主键
- `db.remove(storeName, key)`
   - 移除指定表的某个值
- `db.removeAll(storeName)`
   - 移除指定表的所有值

#### Index-based API（要使用索引必须在创建表时传入表的配置）

- `db.getByIndex(storeName, indexName, index)`
  - 通过索引查询
- `db.getCountByIndex(storeName, indexName, index)`
  - 统计指定表符合索引的数量（索引允许设置非唯一）
- `db.getAllByIndex(storeName, indexName)`
  - 通过索引读取指定表符合条件的值
- `db.getKeyByIndex(storeName, indexName, index)`
  - 根据索引读取值
- `db.getAllKeysByIndex(storeName, indexName)`
  - 获取索引表内所有主键值

#### ScrollableResults API（使用游标比基础效率要高）

- `db.getAllByCursor(storeName)`
  - 使用游标读取指定表所有值
- `db.updateByCursor(storeName, attrName, attr, newVal)`
  - 使用游标更新值
- `db.deleteByCursor(storeName, attrName, attr)`
  - 使用游标删除值

## 5. return & error

 由于异步的关系，所以API都返回promise，部分需要获取返回值的API，建议使用await的方法获取。

example：

```
async newUser(db, obj) {
	await db.open();
	await db.set('user', obj);
	const users = await db.getAll('user');
	
	console.log(users);
	db.close();
}
```

